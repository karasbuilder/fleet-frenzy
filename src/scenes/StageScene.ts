import Phaser from "phaser";
import { getStage, onStageChange, type Stage } from "../game/stage";
import { FONT } from "../game/theme";

export abstract class StageScene extends Phaser.Scene {
  protected stage!: Stage;

  protected abstract build(): void;

  create(): void {
    this.relayout();
    const off = onStageChange(() => this.relayout());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    const clear = () => this.clearHeldInput();
    this.events.on("utxoplay:clear-input", clear);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off("utxoplay:clear-input", clear));
  }

  protected clearHeldInput(): void { this.input.keyboard?.resetKeys(); }

  protected relayout(): void {
    this.stage = getStage();
    const { W, H, zoom } = this.stage;
    this.tweens.killAll();
    // DisplayList.removeAll(true) skips removal callbacks; unlike a Container,
    // it does not destroy children. Explicit destruction also detaches input.
    for (const child of [...this.children.list]) child.destroy();
    const cam = this.cameras.main;
    cam.setZoom(zoom);
    cam.centerOn(W / 2, H / 2);
    this.drawBackdrop();
    this.build();
  }

  protected drawBackdrop(): void {
    const { W, H } = this.stage;
    const bg = this.add.image(W / 2, H / 2, "ocean");
    bg.setScale(Math.max(W / bg.width, H / bg.height));
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x021a3a, 0x021a3a, 0x04264f, 0x04264f, 0.62, 0.62, 0.2, 0.2);
    shade.fillRect(0, 0, W, H);
  }

  protected label(
    x: number,
    y: number,
    text: string,
    size: number,
    color = "#ffffff",
    style: Phaser.Types.GameObjects.Text.TextStyle = {},
  ): Phaser.GameObjects.Text {
    return makeText(this, x, y, text, size, color, style);
  }
}

export function makeText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  size: number,
  color = "#ffffff",
  style: Phaser.Types.GameObjects.Text.TextStyle = {},
): Phaser.GameObjects.Text {
  const t = scene.add.text(x, y, text, {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color,
    fontStyle: "bold",
    stroke: "#021a3a",
    strokeThickness: Math.max(2, Math.round(size / 9)),
    resolution: Math.min(3, Math.ceil(getStage().zoom)),
    ...style,
  });
  return t.setOrigin(0.5);
}
