// Pixel sprites for player pieces and prize badges.
//
// Drawn as 8x8 grids and rendered as inline SVG rects — no image files, no
// font dependency, crisp at any size, and coloured from the app palette.
// Platform emoji were doing none of that: they render differently on every
// phone and look glossy against a bar-top UI.
//
// At the size these appear on the board (~15px) colour does most of the
// identifying work, so every token owns a distinct hue.

export interface PixelSprite {
  id: string;
  name: string;
  /** Dominant colour — used for chip rings and small-size fallbacks. */
  tint: string;
  palette: Record<string, string>;
  /** 8 rows of 8 characters; "." is transparent. */
  pixels: string[];
}

const AMBER = "#ffb92e";
const ORANGE = "#f97316";
const SILVER = "#c4c8d0";
const GREEN = "#4ce07b";
const BONE = "#f2f0ea";
const PINK = "#ff5c8a";
const VIOLET = "#a78bfa";
const CYAN = "#38bdf8";
const INK = "#0b0b0d";

export const PLAYER_TOKENS: PixelSprite[] = [
  {
    id: "martini",
    name: "Martini",
    tint: AMBER,
    palette: { L: AMBER, G: BONE },
    pixels: [
      "........",
      "LLLLLLLL",
      ".LLLLLL.",
      "..LLLL..",
      "...GG...",
      "...GG...",
      "..GGGG..",
      "........",
    ],
  },
  {
    id: "pint",
    name: "Pint",
    tint: ORANGE,
    palette: { H: BONE, B: ORANGE },
    pixels: [
      "........",
      ".HHHHHH.",
      ".BBBBBB.",
      ".BBBBBB.",
      ".BBBBBB.",
      ".BBBBBB.",
      ".BBBBBB.",
      "........",
    ],
  },
  {
    id: "shaker",
    name: "Shaker",
    tint: SILVER,
    palette: { S: SILVER, K: INK },
    pixels: [
      "..SSSS..",
      "..SKKS..",
      ".SSSSSS.",
      ".SSSSSS.",
      ".SSSSSS.",
      ".SSSSSS.",
      "..SSSS..",
      "........",
    ],
  },
  {
    id: "lime",
    name: "Lime",
    tint: GREEN,
    palette: { G: "#1f7a3d", F: GREEN },
    pixels: [
      "........",
      "..GGGG..",
      ".GFFFFG.",
      "GFFFFFFG",
      "GFFFFFFG",
      ".GFFFFG.",
      "..GGGG..",
      "........",
    ],
  },
  {
    id: "skull",
    name: "Skull",
    tint: BONE,
    palette: { W: BONE, K: INK },
    pixels: [
      "........",
      ".WWWWWW.",
      "WWWWWWWW",
      "WKKWWKKW",
      "WWWWWWWW",
      ".WWWWWW.",
      ".W.WW.W.",
      "........",
    ],
  },
  {
    id: "flame",
    name: "Flame",
    tint: PINK,
    palette: { P: PINK, O: AMBER },
    pixels: [
      "...P....",
      "..PPP...",
      ".PPPPP..",
      ".PPOPP..",
      ".POOOP..",
      ".POOOP..",
      "..POP...",
      "........",
    ],
  },
  {
    id: "dice",
    name: "Dice",
    tint: VIOLET,
    palette: { D: VIOLET, K: INK },
    pixels: [
      "DDDDDDDD",
      "DKDDDDKD",
      "DDDDDDDD",
      "DDDKKDDD",
      "DDDKKDDD",
      "DDDDDDDD",
      "DKDDDDKD",
      "DDDDDDDD",
    ],
  },
  {
    id: "bottle",
    name: "Bottle",
    tint: CYAN,
    palette: { B: CYAN, L: BONE },
    pixels: [
      "...BB...",
      "...BB...",
      "..BBBB..",
      "..BLLB..",
      "..BLLB..",
      "..BLLB..",
      "..BBBB..",
      "........",
    ],
  },
];

export const PRIZE_BADGES: PixelSprite[] = [
  {
    id: "cash",
    name: "Cash",
    tint: GREEN,
    palette: { G: "#1f7a3d", W: "#d7f7e2" },
    pixels: [
      "............",
      "............",
      ".GGGGGGGGGG.",
      ".GWWWWWWWWG.",
      ".GGGGGGGGGG.",
      ".GWWWWWWWWG.",
      ".GGGGGGGGGG.",
      ".GWWWWWWWWG.",
      ".GGGGGGGGGG.",
      "............",
      "............",
      "............",
    ],
  },
  {
    id: "trophy",
    name: "Trophy",
    tint: AMBER,
    palette: { Y: AMBER },
    pixels: [
      "............",
      "..YYYYYYYY..",
      "..Y......Y..",
      ".YY......YY.",
      ".YY......YY.",
      "..YYYYYYYY..",
      "....YYYY....",
      ".....YY.....",
      ".....YY.....",
      "...YYYYYY...",
      "..YYYYYYYY..",
      "............",
    ],
  },
  {
    id: "medal",
    name: "Medal",
    tint: AMBER,
    palette: { R: PINK, Y: AMBER, W: BONE },
    pixels: [
      "...RR..RR...",
      "...RR..RR...",
      "...RRRRRR...",
      "..YYYYYYYY..",
      ".YYYYYYYYYY.",
      ".YYYYWWYYYY.",
      ".YYYYWWYYYY.",
      ".YYYYYYYYYY.",
      "..YYYYYYYY..",
      "...YYYYYY...",
      "............",
      "............",
    ],
  },
  {
    id: "timeoff",
    name: "Time off",
    tint: CYAN,
    palette: { W: CYAN, K: INK },
    pixels: [
      "....WWWW....",
      "..WWWWWWWW..",
      ".WWWWWWWWWW.",
      ".WWWWKWWWWW.",
      "WWWWWKWWWWWW",
      "WWWWWKKKWWWW",
      "WWWWWWWWWWWW",
      ".WWWWWWWWWW.",
      ".WWWWWWWWWW.",
      "..WWWWWWWW..",
      "....WWWW....",
      "............",
    ],
  },
  {
    id: "keys",
    name: "Keys",
    tint: SILVER,
    palette: { K: SILVER },
    pixels: [
      "............",
      "...KKKK.....",
      "..K....K....",
      "..K....K....",
      "...KKKK.....",
      "....KK......",
      "....KK......",
      "....KKK.....",
      "....KK......",
      "....KKK.....",
      "............",
      "............",
    ],
  },
  {
    id: "star",
    name: "Star",
    tint: AMBER,
    palette: { Y: AMBER },
    pixels: [
      ".....YY.....",
      ".....YY.....",
      "....YYYY....",
      "YYYYYYYYYYYY",
      ".YYYYYYYYYY.",
      "..YYYYYYYY..",
      "...YYYYYY...",
      "..YYYYYYYY..",
      "..YYY..YYY..",
      ".YY......YY.",
      "............",
      "............",
    ],
  },
];

const ALL = [...PLAYER_TOKENS, ...PRIZE_BADGES];

/** Look up a sprite by id, falling back to the first player token. */
export function spriteById(id: string | undefined, pool: PixelSprite[] = PLAYER_TOKENS): PixelSprite {
  return (
    ALL.find((s) => s.id === id) ?? pool[0]
  );
}

export const DEFAULT_TOKEN = PLAYER_TOKENS[0].id;
export const DEFAULT_BADGE = PRIZE_BADGES[1].id;
