import type Phaser from "phaser";
import { getStage, onStageChange } from "./stage";

const parentOrigin = new URL(document.referrer || location.href).origin;
let attempt = new URLSearchParams(location.search).get("launch") || "fleet-frenzy:0";
let progress = 10;
let complete = false;
let failure = "";

function report(): void {
  if (parent === window) return;
  parent.postMessage({
    type: "utxoplay:load", game: "fleet-frenzy", attempt, progress,
    phase: failure ? "Unable to load the fleet" : complete ? "Ready to sail" : "Preparing the fleet",
    detail: "Fleet Frenzy by Karas", steps: [true, progress >= 55, progress >= 85, complete],
    ready: complete, error: failure,
  }, parentOrigin);
}
export function reportAssets(fraction: number): void {
  progress = Math.max(progress, 10 + Math.floor(Math.min(1, fraction) * 45)); report();
}
export function reportFailure(message = "Please retry loading Fleet Frenzy."): void {
  failure = message; complete = false; report();
  const error = document.getElementById("host-error")!;
  error.hidden = false;
}
export function reportReady(): void {
  progress = 85; report();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    if (failure) return;
    complete = true; progress = 100; report();
  }));
}
export function exitToStore(): void {
  if (parent === window) location.assign("https://store.utxoplay.io/");
  else parent.postMessage({ type: "utxoplay:exit", game: "fleet-frenzy", attempt }, parentOrigin);
}
addEventListener("message", e => {
  if (e.source !== parent || e.origin !== parentOrigin || e.data?.type !== "utxoplay:load-request" || !/^fleet-frenzy:\d+$/.test(e.data.attempt)) return;
  attempt = e.data.attempt; report();
});

export function bindHosting(game: Phaser.Game): void {
  const paused = new Set<string>();
  const reasons = new Set<string>();
  const overlay = document.getElementById("host-pause")!;
  let wasPortrait = false;
  let lastState = "";
  const sync = () => {
    const portrait = getStage().rotateGate;
    const active = game.scene.getScenes(true).filter(scene => scene.scene.key !== "Gate");
    const state = `${portrait}:${complete}:${[...reasons].sort()}:${active.map(s => s.scene.key)}`;
    if (state === lastState) return;
    lastState = state;
    document.body.dataset.portrait = String(portrait);
    const blocked = reasons.size > 0;
    if (blocked) {
      for (const scene of active) {
        scene.events.emit("utxoplay:clear-input");
        scene.input.keyboard?.resetKeys();
        game.scene.pause(scene.scene.key);
        paused.add(scene.scene.key);
      }
      game.input.pointers.forEach(pointer => pointer.reset());
    } else {
      for (const key of paused) if (game.scene.isPaused(key)) game.scene.resume(key);
      paused.clear();
    }
    overlay.hidden = !blocked || portrait;
    document.getElementById("host-tools")!.hidden = portrait || !complete;
  };
  const pause = () => { reasons.add("manual"); sync(); };
  const orientation = () => {
    const portrait = getStage().rotateGate;
    if (portrait) reasons.add("portrait");
    else {
      reasons.delete("portrait");
      if (wasPortrait && (game.scene.isPaused("Battle") || game.scene.isPaused("Placement"))) reasons.add("manual");
    }
    wasPortrait = portrait; sync();
  };
  document.getElementById("host-pause-button")!.onclick = pause;
  document.getElementById("host-resume")!.onclick = () => {
    if (getStage().rotateGate || document.hidden) return;
    reasons.delete("manual"); reasons.delete("hidden"); sync(); game.canvas.focus();
  };
  for (const id of ["host-return", "host-pause-return"]) document.getElementById(id)!.onclick = exitToStore;
  document.getElementById("host-retry")!.onclick = () => location.reload();
  document.getElementById("host-fullscreen")!.onclick = async () => {
    try {
      if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      await (screen.orientation as ScreenOrientation & {lock?: (value: string) => Promise<void>}).lock?.("landscape");
    } catch { /* The game-owned portrait gate provides the rotation fallback. */ }
  };
  addEventListener("keydown", e => {
    if (e.key !== "Escape" || e.repeat) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (reasons.has("manual")) document.getElementById("host-resume")!.click(); else pause();
  }, true);
  addEventListener("blur", pause);
  addEventListener("visibilitychange", () => {
    if (document.hidden) reasons.add("hidden"); else { reasons.delete("hidden"); reasons.add("manual"); }
    sync();
  });
  addEventListener("pointercancel", () => {
    for (const scene of game.scene.getScenes(false)) scene.events.emit("utxoplay:clear-input");
    game.input.pointers.forEach(pointer => pointer.reset());
  });
  onStageChange(orientation);
  game.events.on("step", orientation);
  game.canvas.tabIndex = 0;
  orientation(); report();
}
