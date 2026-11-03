import type Phaser from "phaser";
import { session } from "./session";

export const SFX_FILES = [
  "ui-click", "ui-error", "ship-rotate", "ship-snap", "blast", "hit", "miss-splash", "ship-sunk", "victory", "defeat",
] as const;
export type Sfx = (typeof SFX_FILES)[number];

let music: Phaser.Sound.BaseSound | null = null;

export function play(scene: Phaser.Scene, key: Sfx, volume = 0.7): void {
  if (session.muted) return;
  scene.sound.play(key, { volume });
}

export function startMusic(scene: Phaser.Scene): void {
  scene.sound.mute = session.muted;
  if (!music) music = scene.sound.add("ocean-rush-loop", { loop: true, volume: 0.28 });
  if (!music.isPlaying) music.play();
}

export function setMuted(scene: Phaser.Scene, muted: boolean): void {
  session.muted = muted;
  scene.sound.mute = muted;
  if (!muted) startMusic(scene);
}
