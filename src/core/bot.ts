import { BOARD_SIZE, FLEET } from "./types";
import type { Coord, Difficulty, ShipName, ShotOutcome, ShotRecord } from "./types";
import { cellKey } from "./board";

const HIT_WEIGHT = 50;

interface HeatView {
  shots: readonly ShotRecord[];
  remainingSizes: readonly number[];
  unresolvedHits: readonly Coord[];
}

const inRange = (v: number) => v >= 0 && v < BOARD_SIZE;

export function computeHeatmap(view: HeatView): number[][] {
  const blocked = new Set<string>();
  for (const s of view.shots) if (s.result !== "hit") blocked.add(cellKey(s.x, s.y));
  const unresolved = new Set(view.unresolvedHits.map((c) => cellKey(c.x, c.y)));
  const heat = Array.from({ length: BOARD_SIZE }, () => new Array<number>(BOARD_SIZE).fill(0));

  for (const size of view.remainingSizes) {
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        for (const horizontal of [true, false]) {
          const cells: Coord[] = [];
          let ok = true;
          for (let i = 0; i < size && ok; i++) {
            const c = { x: horizontal ? x + i : x, y: horizontal ? y : y + i };
            if (!inRange(c.x) || !inRange(c.y) || blocked.has(cellKey(c.x, c.y))) ok = false;
            else cells.push(c);
          }
          if (!ok) continue;
          const covered = cells.filter((c) => unresolved.has(cellKey(c.x, c.y))).length;
          const weight = covered > 0 ? HIT_WEIGHT * covered : 1;
          for (const c of cells) heat[c.y]![c.x]! += weight;
        }
      }
    }
  }
  for (const s of view.shots) heat[s.y]![s.x] = 0;
  return heat;
}

export class Bot {
  private fired = new Set<string>();
  private shots: ShotRecord[] = [];
  private queue: Coord[] = [];
  private lineHits: Coord[] = [];
  private remainingSizes: number[] = FLEET.map((s) => s.size);
  private unresolved: Coord[] = [];

  constructor(
    private readonly difficulty: Difficulty = "medium",
    private readonly rng: () => number = Math.random,
  ) {}

  nextShot(): Coord {
    if (this.difficulty === "easy") return this.pick(this.open());
    if (this.difficulty === "hard") return this.heatShot();
    return this.mediumShot();
  }

  record(target: Coord, result: ShotOutcome, sunk?: ShipName): void {
    this.fired.add(cellKey(target.x, target.y));
    this.shots.push({ ...target, result });
    if (result === "hit") {
      this.unresolved.push(target);
      this.lineHits.push(target);
      this.queueNeighbours();
    } else if (result === "sunk") {
      this.unresolved.push(target);
      const size = FLEET.find((s) => s.name === sunk)?.size;
      if (size !== undefined) {
        const i = this.remainingSizes.indexOf(size);
        if (i >= 0) this.remainingSizes.splice(i, 1);
        this.resolveSunk(target, size);
      }
      this.lineHits = [];
      this.queue = [];
    }
  }

  private open(): Coord[] {
    const out: Coord[] = [];
    for (let y = 0; y < BOARD_SIZE; y++)
      for (let x = 0; x < BOARD_SIZE; x++) if (!this.fired.has(cellKey(x, y))) out.push({ x, y });
    return out;
  }

  private pick<T>(pool: readonly T[]): T {
    return pool[Math.floor(this.rng() * pool.length)]!;
  }

  private heatShot(): Coord {
    const heat = computeHeatmap({
      shots: this.shots,
      remainingSizes: this.remainingSizes,
      unresolvedHits: this.unresolved,
    });
    let best = 0;
    let cells: Coord[] = [];
    for (let y = 0; y < BOARD_SIZE; y++) {
      for (let x = 0; x < BOARD_SIZE; x++) {
        const v = heat[y]![x]!;
        if (v > best) {
          best = v;
          cells = [{ x, y }];
        } else if (v === best && v > 0) cells.push({ x, y });
      }
    }
    return cells.length > 0 ? this.pick(cells) : this.pick(this.open());
  }

  private mediumShot(): Coord {
    while (this.queue.length > 0) {
      const c = this.queue.pop()!;
      if (!this.fired.has(cellKey(c.x, c.y))) return c;
    }
    const open = this.open();
    const parity = open.filter((c) => (c.x + c.y) % 2 === 0);
    return this.pick(parity.length > 0 ? parity : open);
  }

  private queueNeighbours(): void {
    let next: Coord[];
    if (this.lineHits.length >= 2) {
      const a = this.lineHits[0]!;
      const b = this.lineHits[this.lineHits.length - 1]!;
      const horizontal = a.y === b.y;
      const sorted = [...this.lineHits].sort((p, q) => (horizontal ? p.x - q.x : p.y - q.y));
      const lo = sorted[0]!;
      const hi = sorted[sorted.length - 1]!;
      next = horizontal
        ? [{ x: lo.x - 1, y: lo.y }, { x: hi.x + 1, y: hi.y }]
        : [{ x: lo.x, y: lo.y - 1 }, { x: hi.x, y: hi.y + 1 }];
    } else {
      const h = this.lineHits[0]!;
      next = [
        { x: h.x + 1, y: h.y }, { x: h.x - 1, y: h.y },
        { x: h.x, y: h.y + 1 }, { x: h.x, y: h.y - 1 },
      ];
    }
    this.queue = next.filter((c) => inRange(c.x) && inRange(c.y) && !this.fired.has(cellKey(c.x, c.y)));
  }

  private resolveSunk(target: Coord, size: number): void {
    const has = (c: Coord) => this.unresolved.some((h) => h.x === c.x && h.y === c.y);
    const resolved = new Set<string>([cellKey(target.x, target.y)]);
    if (size > 1) {
      for (const horizontal of [true, false]) {
        const at = (d: number): Coord =>
          horizontal ? { x: target.x + d, y: target.y } : { x: target.x, y: target.y + d };
        const reach = (dir: -1 | 1) => {
          let n = 0;
          while (has(at(dir * (n + 1)))) n++;
          return n;
        };
        const back = reach(-1);
        const fwd = reach(1);
        if (back + fwd + 1 < size) continue;
        const takeFwd = Math.min(fwd, size - 1);
        const takeBack = Math.min(back, size - 1 - takeFwd);
        for (let i = 1; i <= takeFwd; i++) resolved.add(cellKey(at(i).x, at(i).y));
        for (let i = 1; i <= takeBack; i++) resolved.add(cellKey(at(-i).x, at(-i).y));
        break;
      }
    }
    this.unresolved = this.unresolved.filter((h) => !resolved.has(cellKey(h.x, h.y)));
  }
}
