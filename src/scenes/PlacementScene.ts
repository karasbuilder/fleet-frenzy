import { isPositionOpen, randomFleet, rotatedPlacement } from "../core/board";
import { FLEET, shipDef } from "../core/types";
import type { Coord, Ship, ShipName } from "../core/types";
import { play } from "../game/audio";
import { session } from "../game/session";
import { COLOR } from "../game/theme";
import { BoardView } from "../ui/BoardView";
import { Button } from "../ui/Button";
import { StageScene } from "./StageScene";

interface Drag {
  name: ShipName;
  dx: number;
  dy: number;
  moved: boolean;
  wasSelected: boolean;
  candidate: Ship;
}

export class PlacementScene extends StageScene {
  private ships: Ship[] = session.fleet ? session.fleet.map((s) => ({ ...s })) : randomFleet(Math.random);
  private selected: ShipName = "carrier";
  private drag: Drag | null = null;
  private board!: BoardView;
  private rows = new Map<ShipName, Phaser.GameObjects.Graphics>();

  constructor() {
    super("Placement");
  }

  init(): void {
    this.ships = session.fleet ? session.fleet.map((s) => ({ ...s })) : randomFleet(Math.random);
    this.selected = "carrier";
    this.drag = null;
  }

  protected build(): void {
    const { W, H, safe } = this.stage;
    const top = safe.top + 74;
    const avail = H - top - safe.bottom - 22;
    const cell = Math.min(64, Math.floor(avail / 10.8));
    const gridSize = cell * 10;
    const panelW = 330;
    const gap = 72;
    const total = gridSize + gap + panelW;
    const gx = Math.round((W - total) / 2 + cell * 0.6);
    const gy = Math.round(top + cell * 0.7 + Math.max(0, (avail - cell * 10.7) / 2));

    this.label(W / 2, safe.top + 40, "DEPLOY YOUR FLEET", 38, "#ffffff");

    this.board = new BoardView(this, gx, gy, cell, COLOR.player);
    this.board.onPointer({
      down: (p) => this.pickUp(p),
      move: (p) => this.dragTo(p),
      up: () => this.drop(),
    });
    this.refreshBoard();

    const px = gx + gridSize + gap;
    let py = gy;
    this.rows.clear();
    for (const def of FLEET) {
      const rowH = 60;
      const hit = this.add.zone(px + panelW / 2, py + rowH / 2, panelW, rowH).setInteractive({ useHandCursor: true });
      const g = this.add.graphics();
      this.rows.set(def.name, g);
      const img = this.add.image(px + 14, py + rowH / 2, def.sprite).setOrigin(0, 0.5);
      img.setScale(24 / img.height);
      this.label(px + 150, py + rowH / 2, def.label, 22, "#ffffff").setOrigin(0, 0.5);
      hit.on("pointerdown", () => {
        this.selected = def.name;
        play(this, "ui-click", 0.5);
        this.refreshBoard();
      });
      py += rowH + 8;
    }
    this.paintRows(px, gy, panelW);

    const by = py + 18;
    const half = (panelW - 12) / 2;
    new Button(this, { x: px + half / 2, y: by + 26, w: half, h: 52, text: "ROTATE", fill: COLOR.player, size: 20, silent: true, onClick: () => this.rotate() });
    new Button(this, { x: px + panelW - half / 2, y: by + 26, w: half, h: 52, text: "SHUFFLE", fill: 0x2a6db0, size: 20, onClick: () => this.shuffle() });
    new Button(this, { x: px + panelW / 2, y: by + 100, w: panelW, h: 72, text: "START BATTLE", size: 30, onClick: () => this.start() });
    new Button(this, { x: px + 70, y: by + 168, w: 140, h: 42, text: "MENU", fill: 0x2a6db0, size: 17, onClick: () => this.scene.start("Menu") });
    this.label(px + panelW - 88, by + 168, "Drag to move · tap to turn", 14, "#bfe8ff", { strokeThickness: 2 });

    const keys = this.input.keyboard;
    keys?.removeAllListeners();
    keys?.on("keydown-R", () => this.rotate());
    keys?.on("keydown-S", () => this.shuffle());
    keys?.on("keydown-ENTER", () => this.start());
    keys?.on("keydown-SPACE", () => this.start());
  }

  private paintRows(px: number, gy: number, panelW: number): void {
    let y = gy;
    for (const def of FLEET) {
      const g = this.rows.get(def.name)!;
      const sel = def.name === this.selected;
      g.clear();
      g.fillStyle(sel ? COLOR.yellow : 0x021a3a, sel ? 0.28 : 0.45).fillRoundedRect(px, y, panelW, 60, 14);
      g.lineStyle(sel ? 3 : 1.5, sel ? COLOR.yellow : 0xffffff, sel ? 1 : 0.25).strokeRoundedRect(px, y, panelW, 60, 14);
      y += 68;
    }
  }

  private refreshBoard(): void {
    this.board.setShips(this.ships, { selected: this.selected });
    if (this.rows.size) this.paintRows(this.board.x + this.board.size + 72, this.board.y, 330);
  }

  private others(name: ShipName): Ship[] {
    return this.ships.filter((s) => s.name !== name);
  }

  private pickUp(p: Phaser.Input.Pointer): void {
    const c = this.board.cellAt(p);
    if (!c) return;
    const ship = this.ships.find((s) => this.cellsOf(s).some((k) => k.x === c.x && k.y === c.y));
    if (!ship) return;
    const wasSelected = this.selected === ship.name;
    this.selected = ship.name;
    this.drag = { name: ship.name, dx: c.x - ship.x, dy: c.y - ship.y, moved: false, wasSelected, candidate: { ...ship } };
    this.refreshBoard();
  }

  private cellsOf(s: Ship): Coord[] {
    const n = shipDef(s.name).size;
    return Array.from({ length: n }, (_, i) => (s.orientation === "horizontal" ? { x: s.x + i, y: s.y } : { x: s.x, y: s.y + i }));
  }

  private dragTo(p: Phaser.Input.Pointer): void {
    const d = this.drag;
    if (!d || !p.isDown) return;
    const c = this.board.cellNear(p);
    const current = this.ships.find((s) => s.name === d.name)!;
    const next: Ship = { ...current, x: c.x - d.dx, y: c.y - d.dy };
    if (next.x !== d.candidate.x || next.y !== d.candidate.y) d.moved = true;
    d.candidate = next;
    if (d.moved) this.board.showGhost(next, isPositionOpen(next, this.others(d.name)));
  }

  private drop(): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    this.board.showGhost(null, true);
    if (!d.moved) {
      if (d.wasSelected) this.rotate();
      return;
    }
    if (isPositionOpen(d.candidate, this.others(d.name))) {
      this.ships = this.ships.map((s) => (s.name === d.name ? d.candidate : s));
      play(this, "ship-snap");
    } else {
      play(this, "ui-error");
    }
    this.refreshBoard();
  }

  private rotate(): void {
    const ship = this.ships.find((s) => s.name === this.selected)!;
    const next = rotatedPlacement(ship, this.others(ship.name));
    if (!next) return play(this, "ui-error");
    this.ships = this.ships.map((s) => (s.name === ship.name ? next : s));
    play(this, "ship-rotate");
    this.refreshBoard();
  }

  private shuffle(): void {
    this.ships = randomFleet(Math.random);
    this.refreshBoard();
  }

  private start(): void {
    session.fleet = this.ships.map((s) => ({ ...s }));
    this.scene.start("Battle");
  }
}
