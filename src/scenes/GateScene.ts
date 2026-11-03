import Phaser from "phaser";
import { getStage, onStageChange } from "../game/stage";
import { COLOR } from "../game/theme";
import { makeText } from "./StageScene";

export class GateScene extends Phaser.Scene {
  private block!: Phaser.GameObjects.Rectangle;
  private pivot!: Phaser.GameObjects.Container;
  private title!: Phaser.GameObjects.Text;
  private subtitle!: Phaser.GameObjects.Text;

  constructor() {
    super("Gate");
  }

  create(): void {
    this.block = this.add.rectangle(0, 0, 10, 10, COLOR.deep, 1).setInteractive();
    this.block.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, e: Phaser.Types.Input.EventData) =>
      e.stopPropagation(),
    );
    const phone = this.add.graphics();
    phone.lineStyle(6, 0xffffff, 1).strokeRoundedRect(-34, -56, 68, 112, 12);
    phone.fillStyle(COLOR.yellow, 1).fillCircle(0, 42, 5);
    this.pivot = this.add.container(0, 0, [phone]);
    this.tweens.add({ targets: this.pivot, angle: 90, duration: 900, yoyo: true, repeat: -1, hold: 600, ease: "Sine.easeInOut" });
    this.title = makeText(this, 0, 0, "Rotate your device", 28);
    this.subtitle = makeText(this, 0, 0, "Fleet Frenzy plays in landscape", 17, "#bfe8ff");

    this.apply();
    const off = onStageChange(() => this.apply());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  private apply(): void {
    const s = getStage();
    const { cssW: w, cssH: h } = s;
    this.cameras.main.setZoom(s.ratio).centerOn(w / 2, h / 2);
    this.scene.bringToTop();

    const on = s.rotateGate;
    this.block.setPosition(w / 2, h / 2).setSize(w, h).setVisible(on);
    if (on) this.block.setInteractive();
    else this.block.disableInteractive();
    this.pivot.setPosition(w / 2, h * 0.38).setVisible(on);
    this.title.setPosition(w / 2, h * 0.62).setFontSize(Math.min(30, w / 12)).setVisible(on);
    this.subtitle.setPosition(w / 2, h * 0.7).setFontSize(Math.min(18, w / 20)).setVisible(on);
  }
}
