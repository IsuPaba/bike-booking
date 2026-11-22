/**
 * Colour palettes the client can switch between in the prototype.
 * Each one pairs with one of the hotel website palettes, so the bike site
 * looks like part of the same family. Components only ever use the semantic
 * tokens below (via Tailwind classes) — never hex values.
 */

export type PaletteId = "trail" | "coastal" | "sunrise";

export interface PaletteTokens {
  bg: string; // page background
  surface: string; // cards, panels
  border: string;
  ink: string; // headings + body text
  inkSoft: string; // secondary text
  primary: string; // brand, links, selected states (white text)
  cta: string; // Book / Pay buttons
  ctaInk: string; // text on CTA
  ride: string; // active chips, highlights (dark text)
  tint: string; // image backgrounds, hover, chips
  dark: string; // nav bands, footer, promo banner
  onDarkAccent: string; // accent text/links on dark bands
  accent: string; // decorative accent (icons, ornaments — no small text)
  heroFrom: string;
  heroVia: string;
  heroTo: string;
}

export interface Swatch {
  name: string;
  hex: string;
  role: string;
  fromHotel: boolean;
}

export interface Palette {
  id: PaletteId;
  name: string;
  pairsWith: string;
  tag: string;
  feel: string;
  story: string;
  swatches: Swatch[];
  tokens: PaletteTokens;
}

export const PALETTES: Palette[] = [
  {
    id: "coastal",
    name: "Coastal Ride",
    pairsWith: "Anse Lagoon",
    tag: "Recommended",
    feel: "Fresh, sunny, coastal",
    story:
      "Riding the beach road with the lagoon on one side and granite boulders on the other. Sand, teal, deep ocean and a mango “Rent now”, plus a fresh Palm Lime for active ride states.",
    swatches: [
      { name: "White Sand", hex: "#FBF8F2", role: "Page background", fromHotel: true },
      { name: "Lagoon Teal", hex: "#0B7F82", role: "Brand, links", fromHotel: true },
      { name: "Shallow Turquoise", hex: "#2EC4C0", role: "Illustrations", fromHotel: true },
      { name: "Deep Ocean", hex: "#0B3C5D", role: "Text, footer", fromHotel: true },
      { name: "Mango Sun", hex: "#F4A024", role: "Rent now", fromHotel: true },
      { name: "Palm Lime", hex: "#A8D14F", role: "Active chips", fromHotel: false },
      { name: "Granite Blush", hex: "#C99A85", role: "Accents", fromHotel: true },
      { name: "Sea Foam", hex: "#DDF2F0", role: "Image backgrounds", fromHotel: false },
    ],
    tokens: {
      bg: "#FBF8F2",
      surface: "#FFFFFF",
      border: "#EADFCF",
      ink: "#0B3C5D",
      inkSoft: "#4F6677",
      primary: "#0B7F82",
      cta: "#F4A024",
      ctaInk: "#0B3C5D",
      ride: "#A8D14F",
      tint: "#DDF2F0",
      dark: "#0B3C5D",
      onDarkAccent: "#7FE0DA",
      accent: "#2EC4C0",
      heroFrom: "#0B3C5D",
      heroVia: "#0B7F82",
      heroTo: "#2EC4C0",
    },
  },
  {
    id: "trail",
    name: "Island Trail",
    pairsWith: "La Digue Garden",
    tag: "Closest to the hotel",
    feel: "Green, earthy, relaxed",
    story:
      "Shady palm-lined paths and old plantation trails. Cream, palm green and teak from the hotel, a sunlit Trail Gold for highlights, and Hibiscus for the booking button.",
    swatches: [
      { name: "Cream Sand", hex: "#F4EEDF", role: "Page background", fromHotel: true },
      { name: "Coconut Ivory", hex: "#FFFBF4", role: "Cards", fromHotel: true },
      { name: "Palm Green", hex: "#2F6B4F", role: "Brand, links", fromHotel: true },
      { name: "Deep Jungle", hex: "#1E3D31", role: "Text, footer", fromHotel: true },
      { name: "Teak", hex: "#8A5A3B", role: "Icons, specs", fromHotel: true },
      { name: "Hibiscus", hex: "#C8502F", role: "Rent now", fromHotel: true },
      { name: "Trail Gold", hex: "#E9B949", role: "Active chips", fromHotel: false },
      { name: "Fern Mist", hex: "#DCE8DF", role: "Image backgrounds", fromHotel: true },
    ],
    tokens: {
      bg: "#F4EEDF",
      surface: "#FFFBF4",
      border: "#E4DACA",
      ink: "#1E3D31",
      inkSoft: "#5B6B62",
      primary: "#2F6B4F",
      cta: "#C8502F",
      ctaInk: "#FFFFFF",
      ride: "#E9B949",
      tint: "#DCE8DF",
      dark: "#1E3D31",
      onDarkAccent: "#E9B949",
      accent: "#8A5A3B",
      heroFrom: "#1E3D31",
      heroVia: "#2F6B4F",
      heroTo: "#5E9A6C",
    },
  },
  {
    id: "sunrise",
    name: "Sunrise Pedal",
    pairsWith: "Tropical Sunrise",
    tag: "Most energetic",
    feel: "Bold, sporty, adventurous",
    story:
      "An early-morning ride before the heat: vivid palm green, sunset orange and passion fruit on coconut cream, grounded by Island Night. Great for e-bikes and tours.",
    swatches: [
      { name: "Coconut Cream", hex: "#FFF8EC", role: "Page background", fromHotel: true },
      { name: "Vivid Palm", hex: "#17824A", role: "Brand, links", fromHotel: true },
      { name: "Coco de Mer", hex: "#3A2418", role: "Text", fromHotel: true },
      { name: "Sunset", hex: "#CC4A1F", role: "Rent now", fromHotel: true },
      { name: "Sunset Glow", hex: "#FF7A45", role: "Ribbons", fromHotel: true },
      { name: "Passion Fruit", hex: "#FFC93C", role: "Active chips", fromHotel: true },
      { name: "Island Night", hex: "#12343B", role: "Footer, dark bands", fromHotel: true },
      { name: "Mango Mist", hex: "#FFEBD2", role: "Image backgrounds", fromHotel: false },
    ],
    tokens: {
      bg: "#FFF8EC",
      surface: "#FFFFFF",
      border: "#F0E2CC",
      ink: "#3A2418",
      inkSoft: "#6E5646",
      primary: "#17824A",
      cta: "#CC4A1F",
      ctaInk: "#FFFFFF",
      ride: "#FFC93C",
      tint: "#FFEBD2",
      dark: "#12343B",
      onDarkAccent: "#FFC93C",
      accent: "#FF7A45",
      heroFrom: "#12343B",
      heroVia: "#17824A",
      heroTo: "#FF7A45",
    },
  },
];

export const DEFAULT_PALETTE: PaletteId = "coastal";
const STORAGE_KEY = "rideeasy-palette";

const CSS_VAR: Record<keyof PaletteTokens, string> = {
  bg: "--re-bg",
  surface: "--re-surface",
  border: "--re-border",
  ink: "--re-ink",
  inkSoft: "--re-ink-soft",
  primary: "--re-primary",
  cta: "--re-cta",
  ctaInk: "--re-cta-ink",
  ride: "--re-ride",
  tint: "--re-tint",
  dark: "--re-dark",
  onDarkAccent: "--re-on-dark-accent",
  accent: "--re-accent",
  heroFrom: "--re-hero-from",
  heroVia: "--re-hero-via",
  heroTo: "--re-hero-to",
};

/** "#0B7F82" → "11 127 130" so Tailwind can apply opacity modifiers. */
function hexToChannels(hex: string): string {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(" ");
}

export function getPalette(id: string | null | undefined): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES.find((p) => p.id === DEFAULT_PALETTE)!;
}

export function applyPalette(id: PaletteId): void {
  const palette = getPalette(id);
  const root = document.documentElement;
  (Object.keys(CSS_VAR) as (keyof PaletteTokens)[]).forEach((key) => {
    root.style.setProperty(CSS_VAR[key], hexToChannels(palette.tokens[key]));
  });
  root.dataset.palette = palette.id;
  const meta = document.querySelector('meta[name="theme-color"]') ?? document.head.appendChild(document.createElement("meta"));
  meta.setAttribute("name", "theme-color");
  meta.setAttribute("content", palette.tokens.dark);
}

/** Palette from ?palette= in the URL (handy for sharing a link), else the saved choice. */
export function initialPaletteId(): PaletteId {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("palette");
    if (fromUrl && PALETTES.some((p) => p.id === fromUrl)) return fromUrl as PaletteId;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && PALETTES.some((p) => p.id === saved)) return saved as PaletteId;
  } catch {
    /* storage blocked — fall back to default */
  }
  return DEFAULT_PALETTE;
}

export function savePaletteId(id: PaletteId): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    /* ignore */
  }
}
