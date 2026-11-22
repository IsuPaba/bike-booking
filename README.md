# Ride Easy · Bike Rentals — clickable prototype (v2, SRS v0.1)

A client-demo prototype of a bicycle rental platform for La Digue, Seychelles. The hotel sources bicycles from local vendors and earns a commission. Tourists book several bicycles in a cart, choose self-pickup or delivery to their hotel, pay online or in cash, and show a PIN at handover.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pricing, availability and booking-rule unit tests
npm run build
```

| Area | URL | Demo login (password `Demo@2026`) |
|---|---|---|
| Tourist site | `/` | none |
| Handover staff app (phone-first) | `/staff` | `staff@demo.test` |
| Admin back office | `/admin` | `admin@demo.test` |

Demo script and the SRS decisions (Q1–Q14): `/admin/demo-guide`.

### Demo bookings

Try these on **Find my booking** (the page also lists them so you can click to fill them in), or open them in the staff app with the PIN:

| Reference | PIN | What it shows |
|---|---|---|
| BK-DEMO01 | 1234 | Self-pickup today, paid by card |
| BK-DEMO02 | 2468 | Delivery today, cash due at handover |
| BK-DEMO03 | 1357 | Upcoming, can still be cancelled |
| BK-DEMO04 | 9876 | Completed and returned |

The guest emails come from the demo data, e.g. `sophie@example.com` for BK-DEMO01. Card `4242 4242 4242 4242` pays; `4000 0000 0000 0002` is declined.

## Colour palettes

The **Palette** button switches the whole site between Coastal Ride (default), Island Trail and Sunrise Pedal, each paired with a hotel website palette. **Share link** copies a URL with `?palette=coastal|trail|sunrise`. Palettes live in `src/theme/palettes.ts` and are applied as CSS variables, so components never use hex values.

## How it's built

- Vite + React 18 + TypeScript + Tailwind, react-router, zod + react-hook-form, Leaflet/OpenStreetMap for maps.
- **Business rules are framework-free** (ready for the mobile app):
  - `src/lib/pricing.ts`: per-calendar-day pricing (BRL-001), per-day seasonal discounts (BRL-005), best discount only (BRL-004), cart totals with delivery fee, commission.
  - `src/lib/availability.ts`: daily limit checked on every rental day (BRL-008), 15-minute payment holds.
  - `src/lib/rules.ts`: reference and PIN, minimum notice, cancellation window, handover blockers (BRL-007), duplicate bicycle numbers (FR-040), passport masking (BRL-013).
  - `src/lib/reports.ts`: dashboard and reports (revenue counts only handed-over and completed bookings).
- **Prototype backend:** `src/lib/db.ts` keeps the data in the browser (localStorage), seeded from `src/lib/seed.ts` with dates relative to today. `src/lib/api.ts` is the only module that touches it and mirrors the database functions (`create_booking`, `get_booking_by_reference`, `cancel_booking_by_guest`, `verify_pin`, `record_handover`, `record_return`, `listing_availability`) and the role rules. Replace that file to move to a hosted database. Reset the demo data in Admin → Settings.
- Emails are stored in an outbox (Admin → Sent emails), and an audit log records handovers, returns, payments, cancellations, vendor assignments and price changes.

## Simulated or not included

Real payments and refunds, real emails, a hosted database and real sign-in (everything runs in the browser), multiple languages, live delivery tracking, a vendor self-service portal, and the mobile app.
