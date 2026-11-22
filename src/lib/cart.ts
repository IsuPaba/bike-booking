/** Cart (FR-017–FR-019): one set of dates for every bicycle, persisted in local storage. */
import { useSyncExternalStore } from "react";
import { addDays, scDate } from "./time";
import type { DateStr } from "./types";

export interface CartLine {
  listing_id: string;
  quantity: number;
}
export interface Cart {
  start_date: DateStr;
  end_date: DateStr;
  lines: CartLine[];
}

const KEY = "rideeasy-cart";
const listeners = new Set<() => void>();
const defaultCart = (): Cart => ({ start_date: addDays(scDate(new Date()), 1), end_date: addDays(scDate(new Date()), 2), lines: [] });

let cache: Cart | null = null;
function read(): Cart {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Cart) : null;
    // Drop carts whose start date has passed
    cache = parsed && parsed.start_date >= scDate(new Date()) ? parsed : defaultCart();
  } catch {
    cache = defaultCart();
  }
  return cache;
}

function write(next: Cart) {
  cache = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage blocked: keep in memory */
  }
  listeners.forEach((l) => l());
}

export const cart = {
  get: read,
  setDates(start_date: DateStr, end_date: DateStr) {
    write({ ...read(), start_date, end_date });
  },
  add(listing_id: string, quantity: number) {
    const c = read();
    const existing = c.lines.find((l) => l.listing_id === listing_id);
    write({ ...c, lines: existing ? c.lines.map((l) => (l === existing ? { ...l, quantity: l.quantity + quantity } : l)) : [...c.lines, { listing_id, quantity }] });
  },
  setQuantity(listing_id: string, quantity: number) {
    const c = read();
    write({ ...c, lines: c.lines.map((l) => (l.listing_id === listing_id ? { ...l, quantity: Math.max(1, quantity) } : l)) });
  },
  remove(listing_id: string) {
    const c = read();
    write({ ...c, lines: c.lines.filter((l) => l.listing_id !== listing_id) });
  },
  clear() {
    write({ ...read(), lines: [] });
  },
};

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      cache = null;
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useCart(): Cart {
  return useSyncExternalStore(subscribe, read);
}

export const cartCount = (c: Cart) => c.lines.reduce((s, l) => s + l.quantity, 0);
