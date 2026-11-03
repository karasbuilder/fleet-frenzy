import type { Match } from "../core/match";
import { BOARD_SIZE, DIFFICULTY_LABEL, FLEET } from "../core/types";
import type { ShipName } from "../core/types";
import { play } from "../game/audio";
import { recordResult, session } from "../game/session";
import { COLOR } from "../game/theme";
import { BoardView } from "../ui/BoardView";
import { Button } from "../ui/Button";
import { StageScene } from "./StageScene";

export class ResultScene extends StageScene {
  private match!: Match;

  constructor() {
    super("Result");
  }

  init(data: { match: Match }): void {
    this.match = data.match;
    const won = this.match.winner === "player";
    recordResult(won);
  }

  create(): void {
    super.create();
    play(this, this.match.winner === "player" ? "victory" : "defeat");
  }

  protected build(): void {
    const { W, H, safe } = this.stage;
    const m = this.match;
    const won = m.winner === "player";
    const surrendered = m.endReason === "surrender";
    const top = safe.top + 14;

    this.label(W / 2, top + 40, won ? "VICTORY!" : surrendered ? "SURRENDERED" : "DEFEAT", 64, won ? "#ffd529" : "#ff786e");

    const avail = H - top - 100 - safe.bottom - 130;
    const cell = Math.max(22, Math.min(46, Math.floor(avail / 10.8), Math.floor((W - 520) / 20)));
    const size = cell * BOARD_SIZE;
    const gy = Math.round(top + 130);
    const left = new BoardView(this, Math.round(W / 2 - 150 - size), gy, cell, COLOR.player);
    const right = new BoardView(this, Math.round(W / 2 + 150), gy, cell, COLOR.rival);

    const show = (board: BoardView, ships: Match["playerShips"], shots: Match["shots"]["bot"], sunk: readonly ShipName[]) => {
      board.setShips(ships, { sunk: new Set(sunk), alpha: 0.92 });
      for (const shot of shots) board.mark(shot, shot.result === "miss" ? "miss" : "hit");
    };
    show(left, m.playerShips, m.shots.bot, m.sunk.player);
    show(right, m.botShips, m.shots.player, m.sunk.bot);
    this.label(left.x + size / 2, gy + size + 28, "YOUR FLEET", 18, "#9fe4ff", { strokeThickness: 2 });
    this.label(right.x + size / 2, gy + size + 28, "RIVAL FLEET (REVEALED)", 18, "#ffb0aa", { strokeThickness: 2 });

    const fired = m.shots.player.length;
    const hits = m.shots.player.filter((s) => s.result !== "miss").length;
    const acc = fired ? Math.round((hits / fired) * 100) : 0;
    const cx = W / 2;
    const lines = [
      `vs ${DIFFICULTY_LABEL[session.difficulty]}`,
      `Shots  ${fired}`,
      `Hits  ${hits}  (${acc}%)`,
      `Sunk  ${m.sunk.bot.length}/${FLEET.length}`,
      `Lost  ${m.sunk.player.length}/${FLEET.length}`,
    ];
    lines.forEach((t, i) => this.label(cx, gy + 24 + i * 38, t, i === 0 ? 24 : 22, i === 0 ? "#ffd529" : "#ffffff"));

    const by = H - Math.max(safe.bottom, 10) - 44;
    new Button(this, { x: cx - 140, y: by, w: 250, h: 62, text: "PLAY AGAIN", size: 26, onClick: () => this.scene.start("Placement") });
    new Button(this, { x: cx + 140, y: by, w: 250, h: 62, text: "MENU", fill: 0x2a6db0, size: 26, onClick: () => this.scene.start("Menu") });
  }
}
