import Phaser from "phaser";
import { shipCells } from "../core/board";
import { BOARD_SIZE, shipDef } from "../core/types";
import type { Coord, Ship, ShipName } from "../core/types";
import { dur } from "../game/stage";
import { COLOR } from "../game/theme";
import { makeText } from "../scenes/StageScene";

export type MarkKind = "hit" | "miss" | "sunk";
const COLS = "ABCDEFGHIJ";

export interface ShipStyle {
  selected?: ShipName;
  sunk?: ReadonlySet<ShipName>;
  alpha?: number;
}

export class BoardView {
  readonly size: number;
  private readonly root: Phaser.GameObjects.Container;
  private readonly ships: Phaser.GameObjects.Container;
  private readonly marks: Phaser.GameObjects.Container;
  private readonly overlay: Phaser.GameObjects.Graphics;
  private readonly zone: Phaser.GameObjects.Zone;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly x: number,
    readonly y: number,
    readonly cell: number,
    accent: number,
  ) {
    this.size = cell * BOARD_SIZE;
    const s = this.size;
    this.root = scene.add.container(x, y);

    const frame = scene.add.graphics();
    frame.fillStyle(0x021a3a, 0.5).fillRoundedRect(-8, -8, s + 16, s + 16, 16);
    for (let i = 0; i < BOARD_SIZE; i++)
      for (let j = 0; j < BOARD_SIZE; j++)
        frame.fillStyle(0x0a6fb5, (i + j) % 2 ? 0.34 : 0.22).fillRect(i * cell, j * cell, cell, cell);
    frame.lineStyle(1.5, 0xffffff, 0.22);
    for (let i = 0; i <= BOARD_SIZE; i++) {
      frame.lineBetween(i * cell, 0, i * cell, s);
      frame.lineBetween(0, i * cell, s, i * cell);
    }
    frame.lineStyle(4, accent, 0.95).strokeRoundedRect(-8, -8, s + 16, s + 16, 16);
    this.root.add(frame);

    const fs = Math.max(12, Math.round(cell * 0.38));
    for (let i = 0; i < BOARD_SIZE; i++) {
      this.root.add(makeText(scene, i * cell + cell / 2, -cell * 0.46, String(i + 1), fs, "#d8f3ff"));
      this.root.add(makeText(scene, -cell * 0.5, i * cell + cell / 2, COLS[i]!, fs, "#d8f3ff"));
    }

    this.ships = scene.add.container(0, 0);
    this.marks = scene.add.container(0, 0);
    this.overlay = scene.add.graphics();
    this.zone = scene.add.zone(0, 0, s, s).setOrigin(0, 0).setInteractive();
    this.root.add([this.ships, this.overlay, this.marks, this.zone]);
  }

  cellAt(p: Phaser.Input.Pointer): Coord | null {
    const cx = Math.floor((p.worldX - this.x) / this.cell);
    const cy = Math.floor((p.worldY - this.y) / this.cell);
    return cx >= 0 && cy >= 0 && cx < BOARD_SIZE && cy < BOARD_SIZE ? { x: cx, y: cy } : null;
  }

  cellNear(p: Phaser.Input.Pointer): Coord {
    const clamp = (v: number) => Math.max(0, Math.min(BOARD_SIZE - 1, v));
    return {
      x: clamp(Math.floor((p.worldX - this.x) / this.cell)),
      y: clamp(Math.floor((p.worldY - this.y) / this.cell)),
    };
  }

  centerOf(c: Coord): { x: number; y: number } {
    return { x: this.x + (c.x + 0.5) * this.cell, y: this.y + (c.y + 0.5) * this.cell };
  }

  onPointer(handlers: {
    down?: (p: Phaser.Input.Pointer) => void;
    move?: (p: Phaser.Input.Pointer) => void;
    up?: (p: Phaser.Input.Pointer) => void;
  }): void {
    if (handlers.down) this.zone.on("pointerdown", handlers.down);
    if (handlers.move) this.scene.input.on("pointermove", handlers.move);
    if (handlers.up) {
      this.zone.on("pointerup", handlers.up);
      this.scene.input.on("pointerupoutside", handlers.up);
      this.scene.input.on("pointerup", handlers.up);
    }
  }

  setShips(ships: readonly Ship[], style: ShipStyle = {}): void {
    this.ships.removeAll(true);
    const { cell } = this;
    for (const ship of ships) {
      const def = shipDef(ship.name);
      const horizontal = ship.orientation === "horizontal";
      const cx = (ship.x + (horizontal ? def.size / 2 : 0.5)) * cell;
      const cy = (ship.y + (horizontal ? 0.5 : def.size / 2)) * cell;
      const img = this.scene.add.image(cx, cy, def.sprite);
      img.setScale((cell * 0.98) / img.height);
      if (!horizontal) img.setAngle(90);
      img.setAlpha(style.alpha ?? 1);
      if (style.sunk?.has(ship.name)) img.setTint(0x5a5a66);
      if (style.selected === ship.name) {
        const g = this.scene.add.graphics();
        const w = horizontal ? def.size * cell : cell;
        const h = horizontal ? cell : def.size * cell;
        g.lineStyle(4, COLOR.yellow, 1).strokeRoundedRect(ship.x * cell + 2, ship.y * cell + 2, w - 4, h - 4, 10);
        g.fillStyle(COLOR.yellow, 0.12).fillRoundedRect(ship.x * cell + 2, ship.y * cell + 2, w - 4, h - 4, 10);
        this.ships.add(g);
      }
      this.ships.add(img);
    }
  }

  clearMarks(): void {
    this.marks.removeAll(true);
  }

  mark(c: Coord, kind: MarkKind, animate = false): void {
    const img = this.scene.add.image((c.x + 0.5) * this.cell, (c.y + 0.5) * this.cell, `marker-${kind}`);
    const full = (this.cell * 0.9) / img.height;
    img.setScale(animate && dur(1) ? 0 : full);
    this.marks.add(img);
    if (animate && dur(1)) {
      this.scene.tweens.add({ targets: img, scale: full, duration: dur(260), ease: "Back.easeOut" });
    }
  }

  setTarget(c: Coord | null): void {
    this.overlay.clear();
    if (!c) return;
    const { cell } = this;
    this.overlay.lineStyle(4, COLOR.yellow, 1).strokeRoundedRect(c.x * cell + 3, c.y * cell + 3, cell - 6, cell - 6, 8);
    this.overlay.fillStyle(COLOR.yellow, 0.22).fillRoundedRect(c.x * cell + 3, c.y * cell + 3, cell - 6, cell - 6, 8);
  }

  showGhost(ship: Ship | null, valid: boolean): void {
    this.overlay.clear();
    if (!ship) return;
    const color = valid ? COLOR.good : COLOR.bad;
    for (const c of shipCells(ship)) {
      if (c.x < 0 || c.y < 0 || c.x >= BOARD_SIZE || c.y >= BOARD_SIZE) continue;
      this.overlay.fillStyle(color, 0.4).fillRoundedRect(c.x * this.cell + 2, c.y * this.cell + 2, this.cell - 4, this.cell - 4, 6);
    }
  }

  burst(c: Coord, color: number, radius = 1.4): void {
    if (!dur(1)) return;
    const p = this.centerOf(c);
    const ring = this.scene.add.circle(p.x, p.y, this.cell * 0.2, color, 0).setStrokeStyle(4, color, 0.9);
    this.scene.tweens.add({
      targets: ring,
      radius: this.cell * radius,
      alpha: 0,
      duration: 480,
      ease: "Quad.easeOut",
      onUpdate: () => ring.setStrokeStyle(4 * ring.alpha + 1, color, ring.alpha),
      onComplete: () => ring.destroy(),
    });
  }
}
