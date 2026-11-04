import Phaser from "phaser";

export const DESIGN_H = 720;
export const DESIGN_MIN_W = 1100;
export const BRIDGE_KEEPOUT = { w: 172, h: 58 } as const;

const MAX_DPR = 2;
const MAX_PIXELS = 3840 * 2160;

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Stage {
  cssW: number;
  cssH: number;
  ratio: number;
  scale: number;
  W: number;
  H: number;
  zoom: number;
  safe: Insets;
  rotateGate: boolean;
}

let current: Stage = measure(window.innerWidth, window.innerHeight);
const listeners = new Set<() => void>();

function readInsets(): Insets {
  const probe = document.getElementById("safe-probe");
  if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 };
  const cs = getComputedStyle(probe);
  const px = (v: string) => Number.parseFloat(v) || 0;
  return { top: px(cs.paddingTop), right: px(cs.paddingRight), bottom: px(cs.paddingBottom), left: px(cs.paddingLeft) };
}

function measure(cssW: number, cssH: number): Stage {
  const w = Math.max(1, cssW);
  const h = Math.max(1, cssH);
  const scale = Math.min(h / DESIGN_H, w / DESIGN_MIN_W);
  const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
  const ratio = Math.max(0.5, Math.min(dpr, Math.sqrt(MAX_PIXELS / (w * h))));
  const css = readInsets();
  return {
    cssW: w,
    cssH: h,
    ratio,
    scale,
    W: w / scale,
    H: h / scale,
    zoom: scale * ratio,
    safe: { top: css.top / scale, right: css.right / scale, bottom: css.bottom / scale, left: css.left / scale },
    rotateGate: h > w && (w < 700 || window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0),
  };
}

export const getStage = (): Stage => current;

export function onStageChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function bindStage(game: Phaser.Game, host: HTMLElement): void {
  let queued = 0;
  const apply = () => {
    queued = 0;
    const rect = host.getBoundingClientRect();
    const next = measure(Math.round(rect.width), Math.round(rect.height));
    const changed = next.cssW !== current.cssW || next.cssH !== current.cssH || next.ratio !== current.ratio;
    current = next;
    game.scale.resize(Math.round(next.cssW * next.ratio), Math.round(next.cssH * next.ratio));
    game.canvas.style.width = `${next.cssW}px`;
    game.canvas.style.height = `${next.cssH}px`;
    game.scale.updateBounds();
    game.scale.displayScale.set(next.ratio, next.ratio);
    if (changed) listeners.forEach((fn) => fn());
  };
  const schedule = () => {
    if (!queued) queued = requestAnimationFrame(apply);
  };
  new ResizeObserver(schedule).observe(host);
  window.addEventListener("orientationchange", schedule);
  apply();
}

export const reducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const dur = (ms: number): number => (reducedMotion() ? 0 : ms);
