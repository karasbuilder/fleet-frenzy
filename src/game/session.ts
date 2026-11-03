import type { Difficulty, Ship } from "../core/types";

export const session = {
  difficulty: "medium" as Difficulty,
  muted: false,
  fleet: null as Ship[] | null,
  wins: 0,
  losses: 0,
  streak: 0,
  best: 0,
};

export function recordResult(won: boolean): void {
  if (won) {
    session.wins++;
    session.streak++;
    session.best = Math.max(session.best, session.streak);
  } else {
    session.losses++;
    session.streak = 0;
  }
}
