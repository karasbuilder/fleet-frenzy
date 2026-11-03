import { BOARD_SIZE, FLEET, shipDef } from "./types";
import type { Coord, Ship, ShotResult } from "./types";

export const cellKey = (x: number, y: number): string => `${x},${y}`;

export function inBounds(c: Coord): boolean {
  return c.x >= 0 && c.x < BOARD_SIZE && c.y >= 0 && c.y < BOARD_SIZE;
}

export function shipCells(ship: Ship): Coord[] {
  const size = shipDef(ship.name).size;
  const cells: Coord[] = [];
  for (let i = 0; i < size; i++) {
    cells.push(
      ship.orientation === "horizontal"
        ? { x: ship.x + i, y: ship.y }
        : { x: ship.x, y: ship.y + i },
    );
  }
  return cells;
}

export function isPositionOpen(candidate: Ship, others: readonly Ship[]): boolean {
  const taken = new Set<string>();
  for (const s of others) {
    if (s.name === candidate.name) continue;
    for (const c of shipCells(s)) taken.add(cellKey(c.x, c.y));
  }
  return shipCells(candidate).every((c) => inBounds(c) && !taken.has(cellKey(c.x, c.y)));
}

const NUDGES: ReadonlyArray<readonly [number, number]> = [
  [0, 0], [-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1],
  [-2, 0], [2, 0], [0, -2], [0, 2],
];

export function rotatedPlacement(ship: Ship, others: readonly Ship[]): Ship | null {
  const half = (shipDef(ship.name).size - 1) / 2;
  const horizontal = ship.orientation === "horizontal";
  const cx = ship.x + (horizontal ? half : 0);
  const cy = ship.y + (horizontal ? 0 : half);
  const orientation = horizontal ? "vertical" : "horizontal";
  const ix = Math.round(cx - (orientation === "horizontal" ? half : 0));
  const iy = Math.round(cy - (orientation === "vertical" ? half : 0));
  for (const [dx, dy] of NUDGES) {
    const candidate: Ship = { ...ship, x: ix + dx, y: iy + dy, orientation };
    if (isPositionOpen(candidate, others)) return candidate;
  }
  return null;
}

export function isValidFleet(ships: readonly Ship[]): boolean {
  if (ships.length !== FLEET.length) return false;
  const names = new Set(ships.map((s) => s.name));
  if (names.size !== FLEET.length || !FLEET.every((f) => names.has(f.name))) return false;
  return ships.every((s) => isPositionOpen(s, ships));
}

export function randomFleet(rng: () => number): Ship[] {
  const placed: Ship[] = [];
  for (const def of FLEET) {
    for (let attempt = 0; attempt < 1000; attempt++) {
      const orientation = rng() < 0.5 ? "horizontal" : "vertical";
      const maxX = orientation === "horizontal" ? BOARD_SIZE - def.size : BOARD_SIZE - 1;
      const maxY = orientation === "vertical" ? BOARD_SIZE - def.size : BOARD_SIZE - 1;
      const candidate: Ship = {
        name: def.name,
        x: Math.floor(rng() * (maxX + 1)),
        y: Math.floor(rng() * (maxY + 1)),
        orientation,
      };
      if (isPositionOpen(candidate, placed)) {
        placed.push(candidate);
        break;
      }
    }
  }
  return placed;
}

export function resolveShot(ships: readonly Ship[], prior: readonly Coord[], target: Coord): ShotResult {
  if (prior.some((s) => s.x === target.x && s.y === target.y)) {
    throw new Error("repeated target");
  }
  const shot = new Set(prior.map((s) => cellKey(s.x, s.y)));
  shot.add(cellKey(target.x, target.y));
  const hitShip = ships.find((s) => shipCells(s).some((c) => c.x === target.x && c.y === target.y));
  if (!hitShip) return { result: "miss", allSunk: false };
  const down = (s: Ship) => shipCells(s).every((c) => shot.has(cellKey(c.x, c.y)));
  if (down(hitShip)) {
    return { result: "sunk", sunkShip: hitShip.name, allSunk: ships.every(down) };
  }
  return { result: "hit", allSunk: false };
}
