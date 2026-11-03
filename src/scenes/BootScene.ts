import Phaser from "phaser";
import { SFX_FILES } from "../game/audio";
import { getStage } from "../game/stage";
import { COLOR } from "../game/theme";
import { makeText } from "./StageScene";

const IMAGES = [
  "ocean", "logo", "blast", "surrender", "captain", "rival",
  "ship-carrier", "ship-battleship", "ship-destroyer", "ship-submarine", "ship-patrol-boat",
  "marker-hit", "marker-miss", "marker-sunk", "marker-target",
];

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    const { W, H, zoom } = getStage();
    const cam = this.cameras.main;
    cam.setZoom(zoom).centerOn(W / 2, H / 2);
    cam.setBackgroundColor(COLOR.deep);
    const title = makeText(this, W / 2, H / 2 - 40, "FLEET FRENZY", 54, "#ffffff");
    const trackW = Math.min(420, W * 0.6);
    const track = this.add.graphics();
    track.fillStyle(0x000000, 0.4).fillRoundedRect(W / 2 - trackW / 2, H / 2 + 10, trackW, 18, 9);
    const bar = this.add.graphics();
    this.load.on("progress", (v: number) => {
      bar.clear().fillStyle(COLOR.yellow, 1).fillRoundedRect(W / 2 - trackW / 2, H / 2 + 10, Math.max(18, trackW * v), 18, 9);
    });
    title.setAlpha(0.95);

    this.load.setPath("assets");
    for (const key of IMAGES) this.load.image(key, `img/${key}.png`);
    for (const key of SFX_FILES) this.load.audio(key, `audio/${key}.wav`);
    this.load.audio("ocean-rush-loop", "audio/ocean-rush-loop.wav");
  }

  create(): void {
    this.scene.start("Menu");
    this.scene.launch("Gate");
  }
}
