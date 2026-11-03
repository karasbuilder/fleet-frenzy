import Phaser from "phaser";
import { play } from "../game/audio";
import { dur } from "../game/stage";
import { COLOR } from "../game/theme";
import { makeText } from "../scenes/StageScene";

export interface ButtonOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  text: string;
  onClick: () => void;
  fill?: number;
  textColor?: string;
  size?: number;
  silent?: boolean;
}

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private caption: Phaser.GameObjects.Text;
  private enabled = true;
  private selected = false;

  constructor(scene: Phaser.Scene, private readonly o: ButtonOpts) {
    super(scene, o.x, o.y);
    this.bg = scene.add.graphics();
    this.caption = makeText(scene, 0, -1, o.text, o.size ?? Math.round(o.h * 0.42), o.textColor ?? "#ffffff");
    this.add([this.bg, this.caption]);
    this.setSize(o.w, o.h);
    this.setInteractive({ useHandCursor: true });
    this.redraw(false);

    this.on("pointerover", () => this.enabled && this.redraw(true));
    this.on("pointerout", () => {
      this.redraw(false);
      this.press(1);
    });
    this.on("pointerdown", () => this.enabled && this.press(0.96));
    this.on("pointerup", () => {
      if (!this.enabled) return;
      this.press(1);
      if (!o.silent) play(scene, "ui-click");
      o.onClick();
    });
    scene.add.existing(this);
  }

  private press(scale: number): void {
    this.scene.tweens.killTweensOf(this);
    if (dur(1) === 0) {
      this.setScale(scale);
      return;
    }
    this.scene.tweens.add({ targets: this, scale, duration: 70, ease: "Quad.easeOut" });
  }

  private redraw(hover: boolean): void {
    const { w, h } = this.o;
    const base = this.o.fill ?? COLOR.orange;
    const g = this.bg;
    g.clear();
    const alpha = this.enabled ? 1 : 0.45;
    g.fillStyle(0x000000, 0.35 * alpha).fillRoundedRect(-w / 2, -h / 2 + 5, w, h, h * 0.28);
    g.fillStyle(base, alpha).fillRoundedRect(-w / 2, -h / 2, w, h, h * 0.28);
    g.fillStyle(0xffffff, (hover ? 0.28 : 0.14) * alpha).fillRoundedRect(-w / 2 + 4, -h / 2 + 3, w - 8, h * 0.42, h * 0.2);
    g.lineStyle(this.selected ? 4 : 2, this.selected ? COLOR.yellow : 0xffffff, this.selected ? 1 : 0.55 * alpha);
    g.strokeRoundedRect(-w / 2, -h / 2, w, h, h * 0.28);
  }

  setText(text: string): this {
    this.caption.setText(text);
    return this;
  }

  setEnabled(enabled: boolean): this {
    this.enabled = enabled;
    this.redraw(false);
    this.caption.setAlpha(enabled ? 1 : 0.5);
    return this;
  }

  setSelected(selected: boolean): this {
    this.selected = selected;
    this.redraw(false);
    return this;
  }
}
