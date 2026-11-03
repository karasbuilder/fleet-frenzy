import Phaser from "phaser";
import "./style.css";
import { bindStage, getStage } from "./game/stage";
import { BattleScene } from "./scenes/BattleScene";
import { BootScene } from "./scenes/BootScene";
import { GateScene } from "./scenes/GateScene";
import { MenuScene } from "./scenes/MenuScene";
import { PlacementScene } from "./scenes/PlacementScene";
import { ResultScene } from "./scenes/ResultScene";

const host = document.getElementById("game")!;
const initial = getStage();

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: host,
  backgroundColor: "#04264f",
  banner: false,
  width: Math.round(initial.cssW * initial.ratio),
  height: Math.round(initial.cssH * initial.ratio),
  scale: { mode: Phaser.Scale.NONE },
  input: { activePointers: 2, touch: { capture: true } },
  audio: { disableWebAudio: false },
  scene: [BootScene, MenuScene, PlacementScene, BattleScene, ResultScene, GateScene],
});

bindStage(game, host);
