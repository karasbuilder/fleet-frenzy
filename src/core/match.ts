import { randomFleet, resolveShot, cellKey } from "./board";
import { Bot } from "./bot";
import type { Coord, Difficulty, Ship, ShipName, ShotRecord, ShotResult, Side } from "./types";

export type EndReason = "all_sunk" | "surrender";

export class Match {
  readonly bot: Bot;
  readonly botShips: Ship[];
  readonly shots: Record<Side, ShotRecord[]> = { player: [], bot: [] };
  readonly sunk: Record<Side, ShipName[]> = { player: [], bot: [] };
  turn: Side;
  winner: Side | null = null;
  endReason: EndReason | null = null;

  constructor(
    readonly playerShips: Ship[],
    readonly difficulty: Difficulty,
    rng: () => number = Math.random,
  ) {
    this.bot = new Bot(difficulty, rng);
    this.botShips = randomFleet(rng);
    this.turn = rng() < 0.5 ? "player" : "bot";
  }

  get over(): boolean {
    return this.winner !== null;
  }

  fleetOf(side: Side): readonly Ship[] {
    return side === "player" ? this.playerShips : this.botShips;
  }

  hasFired(by: Side, c: Coord): boolean {
    return this.shots[by].some((s) => s.x === c.x && s.y === c.y);
  }

  fire(by: Side, target: Coord): ShotResult {
    if (this.over) throw new Error("match is over");
    if (this.turn !== by) throw new Error("not your turn");
    if (this.hasFired(by, target)) throw new Error("repeated target");

    const victim: Side = by === "player" ? "bot" : "player";
    const res = resolveShot(this.fleetOf(victim), this.shots[by], target);
    this.shots[by].push({ ...target, result: res.result });
    if (res.sunkShip) this.sunk[victim].push(res.sunkShip);
    if (by === "bot") this.bot.record(target, res.result, res.sunkShip);

    if (res.allSunk) {
      this.winner = by;
      this.endReason = "all_sunk";
    } else if (res.result === "miss") {
      this.turn = victim;
    }
    return res;
  }

  botMove(): { target: Coord; result: ShotResult } {
    const target = this.bot.nextShot();
    return { target, result: this.fire("bot", target) };
  }

  surrender(): void {
    if (this.over) return;
    this.winner = "bot";
    this.endReason = "surrender";
  }

  hitCells(side: Side): Set<string> {
    const attacker: Side = side === "player" ? "bot" : "player";
    return new Set(this.shots[attacker].filter((s) => s.result !== "miss").map((s) => cellKey(s.x, s.y)));
  }
}
