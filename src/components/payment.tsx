import { Banknote } from "lucide-react";
import type { PaymentMethod } from "@/lib/types";

/** Look-alike payment marks for the simulated checkout (prototype only, no real provider). */
export function PaymentLogo({ method, large = false }: { method: PaymentMethod; large?: boolean }) {
  const h = large ? "h-9 text-lg" : "h-7 text-sm";
  if (method === "card") {
    return (
      <span className="flex items-center gap-1.5" aria-hidden>
        <span className={`inline-flex ${h} items-center rounded-md bg-[#1A1F71] px-2 font-black italic tracking-tight text-white`}>VISA</span>
        <span className={`relative inline-flex ${h} w-11 items-center justify-center rounded-md bg-[#111]`}>
          <span className="absolute left-[9px] h-4 w-4 rounded-full bg-[#EB001B]" />
          <span className="absolute right-[9px] h-4 w-4 rounded-full bg-[#F79E1B] mix-blend-screen" />
        </span>
      </span>
    );
  }
  if (method === "google_pay") {
    return <span className={`inline-flex ${h} items-center gap-1 rounded-md bg-black px-3 font-semibold text-white`} aria-hidden><b className="text-[#4285F4]">G</b> Pay</span>;
  }
  return <span className={`inline-flex ${h} items-center gap-1.5 rounded-md bg-status-available-bg px-3 font-semibold text-status-available`} aria-hidden><Banknote size={16} /> Cash</span>;
}

/** Luhn checksum for card numbers. */
export function luhnValid(digits: string): boolean {
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return digits.length >= 13 && sum % 10 === 0;
}

/** The demo card that is always declined (4242 4242 4242 4242 and other valid numbers succeed). */
export const DECLINE_CARD = "4000000000000002";
