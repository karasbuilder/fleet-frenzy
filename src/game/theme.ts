export const COLOR = {
  ink: 0x062c5a,
  deep: 0x04264f,
  player: 0x09b8e7,
  playerLight: 0x56dcf2,
  rival: 0xf0443e,
  rivalLight: 0xff786e,
  yellow: 0xffd529,
  orange: 0xff8a00,
  white: 0xffffff,
  good: 0x25c94a,
  bad: 0xf13a19,
} as const;

export const FONT = '"Arial Rounded MT Bold", "Trebuchet MS", "Segoe UI", system-ui, sans-serif';
export const hex = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;
