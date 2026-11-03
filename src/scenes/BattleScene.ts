import Phaser from "phaser";
import { shipCells } from "../core/board";
import { Match } from "../core/match";
import { BOARD_SIZE, DIFFICULTY_LABEL, FLEET } from "../core/types";
import type { Coord, Ship, ShipName, ShotResult, Side } from "../core/types";
import { play, setMuted } from "../game/audio";
import { session } from "../game/session";
import { BRIDGE_KEEPOUT, dur } from "../game/stage";
import { COLOR } from "../game/theme";
import { BoardView } from "../ui/BoardView";
import { Button } from "../ui/Button";
import { StageScene } from "./StageScene";

type Phase = "player" | "busy" | "bot" | "over";
const COLS = "ABCDEFGHIJ";
const name = (c: Coord) => `${COLS[c.y]}${c.x + 1}`;

export class BattleScene extends StageScene {
  private match!: Match;
  private phase: Phase = "busy";
  private target: Coord | null = null;
  private mine!: BoardView;
  private theirs!: BoardView;
  private banner!: Phaser.GameObjects.Text;
  private targetText!: Phaser.GameObjects.Text;
  private toast = "";
  private confirming = false;

  constructor() {
    super("Battle");
  }

  init(): void {
    this.match = new Match(session.fleet!.map((s) => ({ ...s })), session.difficulty);
    this.phase = "busy";
    this.target = null;
    this.toast = "";
    this.confirming = false;
  }

  create(): void {
    super.create();
    const keys = this.input.keyboard;
    keys?.on("keydown-ENTER", () => this.fire());
    keys?.on("keydown-SPACE", () => this.fire());
    const move = (dx: number, dy: number) => () => this.nudgeTarget(dx, dy);
    keys?.on("keydown-LEFT", move(-1, 0));
    keys?.on("keydown-RIGHT", move(1, 0));
    keys?.on("keydown-UP", move(0, -1));
    keys?.on("keydown-DOWN", move(0, 1));

    const playerFirst = this.match.turn === "player";
    this.setBanner(playerFirst ? "YOU FIRE FIRST" : "RIVAL FIRES FIRST", COLOR.yellow);
    this.time.delayedCall(dur(900), () => (playerFirst ? this.beginPlayerTurn() : this.beginBotTurn()));
  }

  protected build(): void {
    const { W, H, safe, scale } = this.stage;
    const barH = 70;
    const top = safe.top + 8;
    const rightLimit = W - Math.max(safe.right, 0) - BRIDGE_KEEPOUT.w / scale;

    const centreMin = 270;
    const sidePad = Math.max(safe.left, safe.right, 0) + 56;
    const availH = H - top - barH - 12 - safe.bottom - 70;
    const cell = Math.max(24, Math.min(58, Math.floor(Math.min(availH / 11, (W - centreMin - sidePad * 2 - 40) / 20))));
    const size = cell * BOARD_SIZE;
    const gy = Math.round(top + barH + 12 + cell * 0.8);
    const leftX = Math.round(W / 2 - centreMin / 2 - size - 20);
    const rightX = Math.round(W / 2 + centreMin / 2 + 20);

    this.mine = new BoardView(this, leftX, gy, cell, COLOR.player);
    this.theirs = new BoardView(this, rightX, gy, cell, COLOR.rival);
    this.theirs.onPointer({ down: (p) => this.pickTarget(this.theirs.cellAt(p)) });

    this.portrait(leftX, top, "captain", "YOU", COLOR.player, true);
    const rx = Math.min(rightX + size, rightLimit);
    this.portrait(rx, top, "rival", `RIVAL · ${DIFFICULTY_LABEL[session.difficulty].toUpperCase()}`, COLOR.rival, false);
    this.banner = this.label(W / 2, top + barH / 2, "", 30, "#ffffff");

    const cx = W / 2;
    const mid = gy + size / 2;
    this.targetText = this.label(cx, mid - 110, "", 24, "#ffd529");
    const blast = this.add.image(cx, mid - 20, "blast");
    blast.setScale(Math.min(230, centreMin - 30) / blast.width);
    blast.setInteractive({ useHandCursor: true });
    blast.on("pointerdown", () => this.fire());
    this.blastImage = blast;
    this.label(cx, mid + 40, "Tap a rival tile, then BLAST", 15, "#bfe8ff", { strokeThickness: 2 });
    this.toastText = this.label(cx, mid + 90, this.toast, 22, "#ffffff", { align: "center", wordWrap: { width: centreMin } });

    new Button(this, {
      x: cx,
      y: mid + 170,
      w: 150,
      h: 44,
      text: "SURRENDER",
      fill: COLOR.rival,
      size: 16,
      onClick: () => this.askSurrender(),
    });
    const sound = new Button(this, {
      x: cx,
      y: mid + 222,
      w: 150,
      h: 40,
      text: session.muted ? "SOUND OFF" : "SOUND ON",
      fill: 0x2a6db0,
      size: 14,
      onClick: () => {
        setMuted(this, !session.muted);
        sound.setText(session.muted ? "SOUND OFF" : "SOUND ON");
      },
    });

    this.drawFleetRows();
    this.renderBoards();
    this.setBanner(this.bannerText, this.bannerColor);
    this.syncControls();
    if (this.confirming) this.askSurrender();
  }

  private blastImage!: Phaser.GameObjects.Image;
  private toastText!: Phaser.GameObjects.Text;
  private bannerText = "";
  private bannerColor: number = COLOR.white;

  private portrait(x: number, y: number, key: string, text: string, color: number, left: boolean): void {
    const r = 29;
    const cx = left ? x + r : x - r;
    const frame = this.add.graphics();
    frame.fillStyle(color, 1).fillRoundedRect(cx - r - 3, y + 35 - r - 3, r * 2 + 6, r * 2 + 6, 14);
    this.add.image(cx, y + 35, key).setDisplaySize(r * 2, r * 2);
    const t = this.label(left ? cx + r + 12 : cx - r - 12, y + 35, text, 20, "#ffffff");
    t.setOrigin(left ? 0 : 1, 0.5);
  }

  private chips: Phaser.GameObjects.Graphics[] = [];

  private drawFleetRows(): void {
    this.chips.forEach((g) => g.destroy());
    this.chips = [];
    this.fleetRow(this.mine, "player");
    this.fleetRow(this.theirs, "bot");
  }

  private fleetRow(board: BoardView, side: Side): void {
    const sunk = new Set<ShipName>(this.match.sunk[side]);
    const w = (board.size - 4 * 6) / 5;
    const y = board.y + board.size + 18;
    FLEET.forEach((def, i) => {
      const x = board.x + i * (w + 6);
      const dead = sunk.has(def.name);
      const g = this.add.graphics();
      this.chips.push(g);
      g.fillStyle(dead ? COLOR.bad : 0x021a3a, 0.55).fillRoundedRect(x, y, w, 30, 8);
      g.lineStyle(2, dead ? COLOR.rivalLight : 0xffffff, dead ? 0.9 : 0.25).strokeRoundedRect(x, y, w, 30, 8);
      const pip = (w - 16) / def.size;
      for (let k = 0; k < def.size; k++) {
        g.fillStyle(dead ? 0x3a0d14 : COLOR.good, 1).fillRoundedRect(x + 8 + k * pip + 1, y + 11, pip - 2, 8, 3);
      }
    });
  }

  private setBanner(text: string, color: number): void {
    this.bannerText = text;
    this.bannerColor = color;
    this.banner?.setText(text).setColor(`#${color.toString(16).padStart(6, "0")}`);
  }

  private setToast(text: string): void {
    this.toast = text;
    this.toastText?.setText(text);
  }

  private syncControls(): void {
    const can = this.phase === "player" && this.target !== null;
    this.blastImage?.setAlpha(can ? 1 : 0.4);
    this.targetText?.setText(this.target ? `TARGET ${name(this.target)}` : this.phase === "player" ? "PICK A TARGET" : "");
    this.theirs?.setTarget(this.phase === "player" ? this.target : null);
  }

  private renderBoards(animate?: { side: Side; at: Coord }): void {
    const m = this.match;
    const sunkMine = new Set<ShipName>(m.sunk.player);
    const sunkTheirs = new Set<ShipName>(m.sunk.bot);
    this.mine.setShips(m.playerShips, { sunk: sunkMine });
    this.theirs.setShips(m.botShips.filter((s) => sunkTheirs.has(s.name)), { sunk: sunkTheirs });
    this.paintMarks(this.mine, m.shots.bot, m.playerShips, sunkMine, animate?.side === "player" ? animate.at : undefined);
    this.paintMarks(this.theirs, m.shots.player, m.botShips, sunkTheirs, animate?.side === "bot" ? animate.at : undefined);
  }

  private paintMarks(
    board: BoardView,
    shots: readonly (Coord & { result: string })[],
    fleet: readonly Ship[],
    sunk: ReadonlySet<ShipName>,
    fresh?: Coord,
  ): void {
    board.clearMarks();
    const wrecked = new Set<string>();
    for (const s of fleet) if (sunk.has(s.name)) for (const c of shipCells(s)) wrecked.add(`${c.x},${c.y}`);
    for (const s of shots) {
      const isNew = fresh && fresh.x === s.x && fresh.y === s.y;
      const kind = s.result === "miss" ? "miss" : wrecked.has(`${s.x},${s.y}`) ? "sunk" : "hit";
      board.mark(s, kind, !!isNew);
    }
  }

  private pickTarget(c: Coord | null): void {
    if (!c || this.phase !== "player" || this.confirming) return;
    if (this.match.hasFired("player", c)) return play(this, "ui-error", 0.5);
    if (this.target && this.target.x === c.x && this.target.y === c.y) return this.fire();
    this.target = c;
    play(this, "ui-click", 0.5);
    this.syncControls();
  }

  private nudgeTarget(dx: number, dy: number): void {
    if (this.phase !== "player" || this.confirming) return;
    const from = this.target ?? { x: 4, y: 4 };
    const next = {
      x: Phaser.Math.Clamp(from.x + (this.target ? dx : 0), 0, BOARD_SIZE - 1),
      y: Phaser.Math.Clamp(from.y + (this.target ? dy : 0), 0, BOARD_SIZE - 1),
    };
    this.target = next;
    this.syncControls();
  }

  private fire(): void {
    if (this.phase !== "player" || !this.target || this.confirming) return;
    const target = this.target;
    this.target = null;
    this.phase = "busy";
    this.syncControls();
    play(this, "blast");
    this.setBanner("FIRING…", COLOR.yellow);
    this.time.delayedCall(dur(380), () => this.resolve("player", target, this.match.fire("player", target)));
  }

  private beginPlayerTurn(): void {
    this.phase = "player";
    this.setBanner("YOUR TURN", COLOR.playerLight);
    this.syncControls();
  }

  private beginBotTurn(): void {
    this.phase = "bot";
    this.setBanner("RIVAL IS AIMING…", COLOR.rivalLight);
    this.syncControls();
    this.time.delayedCall(650 + Math.random() * 550, () => {
      if (this.phase !== "bot") return;
      const { target, result } = this.match.botMove();
      play(this, "blast", 0.5);
      this.time.delayedCall(dur(300), () => this.resolve("bot", target, result));
    });
  }

  private resolve(by: Side, at: Coord, res: ShotResult): void {
    const board = by === "player" ? this.theirs : this.mine;
    this.renderBoards({ side: by === "player" ? "bot" : "player", at });
    const who = by === "player" ? "You" : "Rival";
    if (res.result === "miss") {
      play(this, "miss-splash");
      board.burst(at, 0xffffff);
      this.setToast(`${who} missed at ${name(at)}`);
    } else {
      play(this, res.result === "sunk" ? "ship-sunk" : "hit");
      board.burst(at, res.result === "sunk" ? COLOR.yellow : COLOR.orange, res.result === "sunk" ? 2.2 : 1.5);
      if (dur(1)) this.cameras.main.shake(res.result === "sunk" ? 260 : 120, 0.004);
      const label = res.sunkShip ? FLEET.find((f) => f.name === res.sunkShip)!.label : "";
      this.setToast(res.result === "sunk" ? `${who === "You" ? "You sank their" : "They sank your"} ${label}!` : `${who === "You" ? "Direct hit" : "Rival hit you"} at ${name(at)}!`);
    }
    this.drawFleetRows();

    if (this.match.over) return this.finish();
    this.time.delayedCall(dur(res.result === "sunk" ? 1300 : 900), () => (this.match.turn === "player" ? this.beginPlayerTurn() : this.beginBotTurn()));
  }

  private finish(): void {
    this.phase = "over";
    const won = this.match.winner === "player";
    this.setBanner(won ? "ENEMY FLEET DESTROYED!" : this.match.endReason === "surrender" ? "YOU SURRENDERED" : "YOUR FLEET IS LOST", won ? COLOR.yellow : COLOR.rivalLight);
    this.syncControls();
    this.time.delayedCall(dur(1600), () => this.scene.start("Result", { match: this.match }));
  }

  private askSurrender(): void {
    if (this.phase === "over") return;
    this.confirming = true;
    const { W, H } = this.stage;
    const shade = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.6).setInteractive().setDepth(100);
    const box = this.add.graphics().setDepth(101);
    box.fillStyle(0x062c5a, 1).fillRoundedRect(W / 2 - 230, H / 2 - 110, 460, 220, 22);
    box.lineStyle(3, 0xffffff, 0.6).strokeRoundedRect(W / 2 - 230, H / 2 - 110, 460, 220, 22);
    const text = this.label(W / 2, H / 2 - 50, "Surrender this battle?", 30).setDepth(102);
    const close = () => {
      this.confirming = false;
      [shade, box, text, yes, no].forEach((o) => o.destroy());
    };
    const yes = new Button(this, { x: W / 2 - 110, y: H / 2 + 45, w: 190, h: 56, text: "SURRENDER", fill: COLOR.rival, size: 20, onClick: () => {
      this.confirming = false;
      this.match.surrender();
      this.finish();
    } }).setDepth(102);
    const no = new Button(this, { x: W / 2 + 110, y: H / 2 + 45, w: 190, h: 56, text: "KEEP FIGHTING", fill: COLOR.good, size: 18, onClick: close }).setDepth(102);
  }
}
