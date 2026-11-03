# Fleet Frenzy

Single-player Battleship against a bot, built with Phaser 4, Vite and TypeScript for [UTXOPlay](https://store.utxoplay.io).

Hit a ship and you shoot again; miss and the turn passes. Sink all 17 enemy ship cells first to win. Three bots: Cadet, Captain, Admiral.

## Controls

- Placement: drag ships, tap or `R` to rotate, `S` to shuffle, `Enter` to start.
- Battle: tap a tile (or arrow keys) to aim, tap it again or `Enter` / BLAST to fire.

Landscape orientation. Progress is kept in memory only and resets on reload.

## Build

Requires Node 22+.

```bash
npm ci
npm test
npm run build
```

Output is in `dist/` with relative asset paths.

## Package

```bash
node tools/package-game.mjs <project-id> ./dist ./release.utxoplay
```

## Credits

Art and audio from [karasbuilder/battle-ship](https://github.com/karasbuilder/battle-ship).
