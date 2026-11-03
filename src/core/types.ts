export const BOARD_SIZE = 10;

export const FLEET = [
  { name: "carrier", size: 5, label: "Carrier", sprite: "ship-carrier" },
  { name: "battleship", size: 4, label: "Battleship", sprite: "ship-battleship" },
  { name: "cruiser", size: 3, label: "Destroyer", sprite: "ship-destroyer" },
  { name: "submarine", size: 3, label: "Submarine", sprite: "ship-submarine" },
  { name: "destroyer", size: 2, label: "Patrol Boat", sprite: "ship-patrol-boat" },
] as const;

export type ShipName = (typeof FLEET)[number]["name"];
export type Orientation = "horizontal" | "vertical";
export type Difficulty = "easy" | "medium" | "hard";
export type Side = "player" | "bot";

export interface Coord {
  x: number;
  y: number;
}

export interface Ship {
  name: ShipName;
  x: number;
  y: number;
  orientation: Orientation;
}

export type ShotOutcome = "miss" | "hit" | "sunk";

export interface ShotResult {
  result: ShotOutcome;
  sunkShip?: ShipName;
  allSunk: boolean;
}

export interface ShotRecord extends Coord {
  result: ShotOutcome;
}

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  easy: "Cadet",
  medium: "Captain",
  hard: "Admiral",
};

export function shipDef(name: ShipName) {
  const def = FLEET.find((s) => s.name === name);
  if (!def) throw new Error(`unknown ship ${name}`);
  return def;
}
