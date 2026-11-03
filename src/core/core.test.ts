import { describe, expect, it } from "vitest";
import { isValidFleet, randomFleet, resolveShot, rotatedPlacement, shipCells, isPositionOpen } from "./board";
import { Bot, computeHeatmap } from "./bot";
import { Match } from "./match";
import { BOARD_SIZE, FLEET } from "./types";
import type { Difficulty, Ship } from "./types";

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

describe("board", () => {
  it("random fleets are always valid", () => {
    for (let seed = 1; seed <= 200; seed++) expect(isValidFleet(randomFleet(lcg(seed)))).toBe(true);
  });

  it("rejects overlap and out of bounds", () => {
    const fleet = randomFleet(lcg(7));
    const first = fleet[0]!;
    const overlapping: Ship = { ...fleet[1]!, x: first.x, y: first.y, orientation: first.orientation };
    expect(isPositionOpen(overlapping, fleet)).toBe(false);
    expect(isPositionOpen({ name: "carrier", x: 8, y: 0, orientation: "horizontal" }, [])).toBe(false);
    expect(isPositionOpen({ name: "carrier", x: 5, y: 0, orientation: "horizontal" }, [])).toBe(true);
  });

  it("resolves miss / hit / sunk / allSunk", () => {
    const ships: Ship[] = [{ name: "destroyer", x: 0, y: 0, orientation: "horizontal" }];
    expect(resolveShot(ships, [], { x: 5, y: 5 }).result).toBe("miss");
    expect(resolveShot(ships, [], { x: 0, y: 0 }).result).toBe("hit");
    const r = resolveShot(ships, [{ x: 0, y: 0 }], { x: 1, y: 0 });
    expect(r).toEqual({ result: "sunk", sunkShip: "destroyer", allSunk: true });
    expect(() => resolveShot(ships, [{ x: 0, y: 0 }], { x: 0, y: 0 })).toThrow();
  });

  it("rotates around the centre and nudges away from edges", () => {
    const ship: Ship = { name: "carrier", x: 0, y: 9, orientation: "horizontal" };
    const rotated = rotatedPlacement(ship, [])!;
    expect(rotated.orientation).toBe("vertical");
    expect(shipCells(rotated).every((c) => c.y >= 0 && c.y < BOARD_SIZE)).toBe(true);
  });
});

describe("bot", () => {
  for (const difficulty of ["easy", "medium", "hard"] as Difficulty[]) {
    it(`${difficulty} never repeats a shot and finishes a game`, () => {
      for (let seed = 1; seed <= 30; seed++) {
        const rng = lcg(seed);
        const match = new Match(randomFleet(rng), difficulty, rng);
        match.turn = "bot";
        let moves = 0;
        while (!match.over) {
          match.botMove();
          match.turn = "bot";
          moves++;
          expect(moves).toBeLessThanOrEqual(BOARD_SIZE * BOARD_SIZE);
        }
        const keys = new Set(match.shots.bot.map((s) => `${s.x},${s.y}`));
        expect(keys.size).toBe(match.shots.bot.length);
        expect(match.winner).toBe("bot");
      }
    });
  }

  it("admiral beats cadet on average", () => {
    const avg = (d: Difficulty) => {
      let total = 0;
      for (let seed = 1; seed <= 60; seed++) {
        const rng = lcg(seed * 31);
        const m = new Match(randomFleet(rng), d, rng);
        m.turn = "bot";
        while (!m.over) { m.botMove(); m.turn = "bot"; }
        total += m.shots.bot.length;
      }
      return total / 60;
    };
    expect(avg("hard")).toBeLessThan(avg("easy") - 10);
  });

  it("heatmap pulls toward unresolved hits", () => {
    const heat = computeHeatmap({
      shots: [{ x: 4, y: 4, result: "hit" }],
      remainingSizes: FLEET.map((f) => f.size),
      unresolvedHits: [{ x: 4, y: 4 }],
    });
    expect(heat[4]![5]!).toBeGreaterThan(heat[0]![0]!);
    expect(heat[4]![4]).toBe(0);
  });

  it("stops chasing a sunk ship", () => {
    const bot = new Bot("hard", lcg(3));
    bot.record({ x: 0, y: 0 }, "hit");
    bot.record({ x: 1, y: 0 }, "sunk", "destroyer");
    for (let i = 0; i < 10; i++) {
      const s = bot.nextShot();
      expect(Math.abs(s.x - 0) + Math.abs(s.y - 0)).toBeGreaterThan(0);
      bot.record(s, "miss");
    }
  });
});

describe("match", () => {
  it("keeps the turn after a hit and passes it after a miss", () => {
    const rng = lcg(5);
    const m = new Match(randomFleet(rng), "easy", rng);
    m.turn = "player";
    const cell = shipCells(m.botShips[0]!)[0]!;
    expect(m.fire("player", cell).result).not.toBe("miss");
    expect(m.turn).toBe("player");
    const occupied = new Set(m.botShips.flatMap((s) => shipCells(s).map((c) => `${c.x},${c.y}`)));
    const water = Array.from({ length: 100 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) })).find((c) => !occupied.has(`${c.x},${c.y}`))!;
    expect(m.fire("player", water).result).toBe("miss");
    expect(m.turn).toBe("bot");
  });

  it("enforces turns, repeats and surrender", () => {
    const rng = lcg(11);
    const m = new Match(randomFleet(rng), "medium", rng);
    m.turn = "player";
    const first = m.fire("player", { x: 0, y: 0 });
    expect(m.turn).toBe(first.result === "miss" ? "bot" : "player");
    m.turn = "bot";
    expect(() => m.fire("player", { x: 1, y: 0 })).toThrow();
    m.turn = "player";
    expect(() => m.fire("player", { x: 0, y: 0 })).toThrow();
    m.surrender();
    expect(m.winner).toBe("bot");
    expect(m.endReason).toBe("surrender");
  });
});
