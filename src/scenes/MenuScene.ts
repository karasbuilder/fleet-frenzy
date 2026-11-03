import { DIFFICULTY_LABEL } from "../core/types";
import type { Difficulty } from "../core/types";
import { setMuted, startMusic } from "../game/audio";
import { session } from "../game/session";
import { BRIDGE_KEEPOUT } from "../game/stage";
import { COLOR } from "../game/theme";
import { Button } from "../ui/Button";
import { StageScene } from "./StageScene";

const BLURB: Record<Difficulty, string> = {
  easy: "Fires at random. A gentle first voyage.",
  medium: "Hunts on a checkerboard, then chases every hit.",
  hard: "Calculates the odds on every shot. Good luck.",
};

export class MenuScene extends StageScene {
  constructor() {
    super("Menu");
  }

  protected build(): void {
    const { W, H, safe, scale } = this.stage;
    const top = safe.top + 16;
    void BRIDGE_KEEPOUT;

    const logo = this.add.image(W / 2, H * 0.2, "logo");
    logo.setScale(Math.min(560, W * 0.55) / logo.width);
    this.tweens.add({ targets: logo, y: logo.y - 6, duration: 2200, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    this.label(W / 2, top + H * 0.37, "CHOOSE YOUR RIVAL", 22, "#bfe8ff");

    const levels: Difficulty[] = ["easy", "medium", "hard"];
    const bw = 190;
    const chips = levels.map((level, i) => {
      const chip = new Button(this, {
        x: W / 2 + (i - 1) * (bw + 18),
        y: top + H * 0.45,
        w: bw,
        h: 58,
        text: DIFFICULTY_LABEL[level].toUpperCase(),
        fill: level === "easy" ? COLOR.good : level === "medium" ? COLOR.player : COLOR.rival,
        onClick: () => {
          session.difficulty = level;
          refresh();
        },
      });
      return { level, chip };
    });
    const blurb = this.label(W / 2, top + H * 0.53, "", 20, "#ffffff");
    const refresh = () => {
      for (const c of chips) c.chip.setSelected(c.level === session.difficulty);
      blurb.setText(BLURB[session.difficulty]);
    };
    refresh();

    new Button(this, {
      x: W / 2,
      y: top + H * 0.66,
      w: 340,
      h: 84,
      text: "PLAY",
      size: 40,
      onClick: () => {
        startMusic(this);
        this.scene.start("Placement");
      },
    });

    const { wins, losses, streak, best } = session;
    this.label(
      W / 2,
      top + H * 0.8,
      wins + losses === 0 ? "No battles yet this session" : `Won ${wins}  ·  Lost ${losses}  ·  Streak ${streak}  ·  Best ${best}`,
      20,
      "#ffffff",
    );
    this.label(W / 2, H - Math.max(safe.bottom, 12 / scale) - 18, "Progress is kept in memory only and resets when you reload.", 15, "#9fd4f2", {
      strokeThickness: 2,
    });

    const sound = new Button(this, {
      x: safe.left + 20 + 80,
      y: H - safe.bottom - 20 - 24,
      w: 160,
      h: 48,
      text: session.muted ? "SOUND OFF" : "SOUND ON",
      fill: 0x2a6db0,
      size: 18,
      onClick: () => {
        setMuted(this, !session.muted);
        sound.setText(session.muted ? "SOUND OFF" : "SOUND ON");
      },
    });
  }
}
