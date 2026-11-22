/** Fictional demo data, generated relative to today so the demo always looks live. */
import { commissionFor, priceLine } from "./pricing";
import { makePin, makeReference } from "./rules";
import { addDays, fromLocalInput, scDate } from "./time";
import { confirmationEmail, receiptEmail } from "./emails";
import type {
  AuditLog, Booking, BookingItem, BookingStatus, Category, Database, Discount, EmailOutbox, Hotel, Listing, ListingImage,
  Payment, PaymentMethod, PickupPoint, Settings, Vendor,
} from "./types";

export const DB_VERSION = 12;

/** Fixed demo bookings to try on Find my booking and in the staff app. */
export const DEMO_BOOKINGS = [
  { reference: "BK-DEMO01", pin: "1234", what: "Self-pickup today, paid by card" },
  { reference: "BK-DEMO02", pin: "2468", what: "Delivery today, cash due at handover" },
  { reference: "BK-DEMO03", pin: "1357", what: "Upcoming, can still be cancelled" },
  { reference: "BK-DEMO04", pin: "9876", what: "Completed and returned" },
];

const IMG = { cruiser: "/images/island-cruiser.jpg", mountain: "/images/mountain-bike.jpg", ebike: "/images/e-bike.jpg", beach: "/images/hero-beach.jpg" };

export const DEFAULT_SETTINGS: Settings = {
  brand_name: "Ride Easy · Bike Rentals",
  tagline: "Explore more. Spend less.",
  currency: "USD",
  delivery_fee: 5,
  return_time: "18:00",
  free_cancellation_hours: 24,
  booking_min_notice_hours_pickup: 2,
  booking_min_notice_hours_delivery: 12,
  contact_phone: "+248 4 000 000",
  whatsapp: "+248 2 500 0000",
  email: "hello@rideeasy.test",
  terms_text: [
    "1. Rentals are priced per calendar day. Collect any time on your first day and return by the return time on your last day.",
    "2. A helmet and lock come with every bicycle. Please lock the bicycle whenever you leave it.",
    "3. Bring your booking PIN and passport to the handover. Bicycle numbers are recorded when you collect.",
    "4. You are responsible for the bicycle while it is with you. Report damage straight away.",
    "5. Free cancellation until 24 hours before your start time. Later cancellations can't be made online.",
    "6. Children under 16 must ride with an adult.",
    "7. This is a prototype. No real payments are taken and no booking is binding.",
  ].join("\n\n"),
};

const vendors: Vendor[] = [
  { id: "v1", business_name: "Grand Anse Cycles", contact_person: "Marie Hoareau", phone: "+248 2 511 0001", email: "marie@grandanse.test", location_text: "Grand Anse road, La Digue", commission_type: "percentage", commission_value: 15, is_active: true, notes: "Largest fleet. City and mountain bikes." },
  { id: "v2", business_name: "La Passe Bike Hire", contact_person: "Jean-Paul Pillay", phone: "+248 2 511 0002", email: "jp@lapassebikes.test", location_text: "Next to the jetty, La Passe", commission_type: "percentage", commission_value: 20, is_active: true, notes: "Can deliver to hotels within 30 minutes." },
  { id: "v3", business_name: "Union Estate Rentals", contact_person: "Nadia Labiche", phone: "+248 2 511 0003", email: "nadia@unionestate.test", location_text: "L'Union Estate entrance", commission_type: "fixed_per_bike_day", commission_value: 2, is_active: true, notes: "Children's bikes and tandems." },
  { id: "v4", business_name: "Island Wheels Co.", contact_person: "Ravi Morel", phone: "+248 2 511 0004", email: "ravi@islandwheels.test", location_text: "Anse Réunion", commission_type: "percentage", commission_value: 10, is_active: true, notes: "E-bike specialist." },
];

const categories: Category[] = [
  { id: "c-women", name: "Women's", slug: "womens", description: "Step-through and city frames, many with baskets.", sort_order: 1 },
  { id: "c-men", name: "Men's", slug: "mens", description: "City, mountain and hybrid frames.", sort_order: 2 },
  { id: "c-children", name: "Children's", slug: "childrens", description: "Smaller frames for young explorers.", sort_order: 3 },
  { id: "c-electric", name: "Electric", slug: "electric", description: "Pedal-assist for the hills.", sort_order: 4 },
];

type ListingSeed = Omit<Listing, "id" | "sort_order" | "is_active"> & { image: string };
const L = (name: string, slug: string, category_id: string, daily_price: number, daily_limit: number, image: string, short: string, features: string[], h: [number, number], extra: Partial<ListingSeed> = {}): ListingSeed => ({
  name, slug, category_id, daily_price, daily_limit, image, short_description: short, features, rider_height_min_cm: h[0], rider_height_max_cm: h[1],
  bike_type: category_id === "c-electric" ? "electric" : "standard", is_featured: false,
  description: `${short} Comfortable, checked before every rental and ready for the island roads. Helmet and lock included.`, ...extra,
});

const listingSeeds: ListingSeed[] = [
  L("Women's city bike with basket", "womens-city-bike", "c-women", 12, 12, IMG.cruiser, "Slow days, scenic routes and a basket for the beach bag.", ["Front basket", "7 gears", "Upright position"], [150, 185], { is_featured: true }),
  L("Women's step-through comfort", "womens-step-through", "c-women", 10, 8, IMG.cruiser, "Easy on, easy off, wonderfully unhurried.", ["Low step frame", "Rear basket", "3 gears"], [145, 180]),
  L("Women's light hybrid", "womens-light-hybrid", "c-women", 15, 6, IMG.mountain, "Light and quick for the longer coastal loops.", ["21 gears", "Light frame", "Bottle holder"], [155, 180]),
  L("Men's mountain bike", "mens-mountain-bike", "c-men", 15, 10, IMG.mountain, "From coastal paths to the inland trails.", ["Front suspension", "21 gears", "Disc brakes"], [165, 195], { is_featured: true }),
  L("Men's city cruiser", "mens-city-cruiser", "c-men", 12, 10, IMG.cruiser, "Relaxed cruising along the beach road.", ["Rear rack", "7 gears", "Wide saddle"], [165, 195]),
  L("Men's hybrid tourer", "mens-hybrid-tourer", "c-men", 18, 5, IMG.mountain, "Fast on tarmac, steady on gravel.", ["24 gears", "Hydraulic brakes", "Rear rack"], [170, 198]),
  L("Children's 20\" bike", "childrens-20", "c-children", 8, 6, IMG.cruiser, "Big adventures for little explorers (ages 6–9).", ["20\" wheels", "Kids' helmet", "Bell"], [115, 135]),
  L("Children's 24\" bike", "childrens-24", "c-children", 9, 4, IMG.cruiser, "For older kids ready for longer rides (ages 9–12).", ["24\" wheels", "6 gears", "Kids' helmet"], [130, 150]),
  L("Electric city bike", "electric-city-bike", "c-electric", 30, 4, IMG.ebike, "A little extra power for a lot more exploring.", ["Pedal assist", "50 km range", "Rear rack"], [155, 190], { is_featured: true }),
  L("Electric trekking bike", "electric-trekking-bike", "c-electric", 35, 3, IMG.ebike, "Long range and strong assist for the steepest hills.", ["Strong assist", "80 km range", "Suspension fork"], [160, 195]),
];

const hotelSeeds: [string, number, number][] = [
  ["Coco Palm Lodge", -4.3555, 55.8318], ["Anse Severe Retreat", -4.3478, 55.8331], ["La Passe Garden Inn", -4.3591, 55.8306],
  ["Takamaka Villas", -4.3632, 55.8291], ["Frangipani Beach Hotel", -4.3712, 55.8269], ["Granite Rock Guesthouse", -4.3667, 55.8355],
  ["Union Plantation Suites", -4.3694, 55.8295], ["Lagoon View Chalets", -4.3528, 55.8352], ["Grand Anse Hideaway", -4.3761, 55.8418],
  ["Pirogue Bay Resort", -4.3585, 55.8402],
];

const guests: [string, string, string][] = [
  ["Sophie Laurent", "France", "+33 6 12 34 56 78"], ["Lukas Weber", "Germany", "+49 151 2345 6789"], ["Emma Thompson", "United Kingdom", "+44 7700 900123"],
  ["Marco Rossi", "Italy", "+39 347 123 4567"], ["Aisha Al Mansoori", "United Arab Emirates", "+971 50 123 4567"], ["Priya Sharma", "India", "+91 98765 43210"],
  ["Johan Andersson", "Sweden", "+46 70 123 45 67"], ["Olivia Martin", "Australia", "+61 412 345 678"], ["Kenji Tanaka", "Japan", "+81 90 1234 5678"],
  ["Isabel García", "Spain", "+34 612 345 678"], ["Noah Müller", "Switzerland", "+41 79 123 45 67"], ["Anna Kowalska", "Poland", "+48 512 345 678"],
  ["Daniel Okafor", "Nigeria", "+234 803 123 4567"], ["Chloé Dubois", "Belgium", "+32 470 12 34 56"], ["Ethan Brooks", "United States", "+1 415 555 0134"],
  ["Mia Jensen", "Denmark", "+45 20 12 34 56"], ["Lucas Silva", "Brazil", "+55 11 91234 5678"], ["Hannah Fischer", "Austria", "+43 664 1234567"],
  ["Ravi Perera", "Sri Lanka", "+94 77 123 4567"], ["Elena Petrova", "Bulgaria", "+359 88 123 4567"], ["Thomas Dupont", "France", "+33 7 98 76 54 32"],
  ["Grace Wanjiru", "Kenya", "+254 712 345678"], ["Sanne de Vries", "Netherlands", "+31 6 12345678"], ["Ahmed Hassan", "Egypt", "+20 100 123 4567"],
  ["Charlotte Evans", "United Kingdom", "+44 7700 900456"], ["Matteo Bianchi", "Italy", "+39 333 765 4321"], ["Yuki Sato", "Japan", "+81 80 9876 5432"],
  ["Liam O'Connor", "Ireland", "+353 87 123 4567"], ["Zara Khan", "South Africa", "+27 82 123 4567"], ["Felix Wagner", "Germany", "+49 160 9876 5432"],
  ["Camille Bernard", "France", "+33 6 98 12 34 56"], ["Oscar Lindqvist", "Sweden", "+46 73 987 65 43"], ["Amelia Clarke", "New Zealand", "+64 21 123 4567"],
  ["Diego Fernández", "Argentina", "+54 9 11 2345 6789"], ["Leila Haddad", "Lebanon", "+961 3 123 456"],
];

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function createSeedDatabase(now: Date = new Date()): Database {
  const today = scDate(now);
  const rand = rng(20261122);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

  const listings: Listing[] = listingSeeds.map(({ image: _i, ...l }, i) => ({ ...l, id: `l${i + 1}`, sort_order: i + 1, is_active: true }));
  const listing_images: ListingImage[] = listingSeeds.flatMap((l, i) => [
    { id: `img${i + 1}a`, listing_id: `l${i + 1}`, storage_path: l.image, is_primary: true, sort_order: 1 },
    { id: `img${i + 1}b`, listing_id: `l${i + 1}`, storage_path: IMG.beach, is_primary: false, sort_order: 2 },
  ]);

  const discounts: Discount[] = [
    { id: "d1", name: "Festive Season", discount_type: "percentage", value: 15, starts_on: addDays(today, -5), ends_on: addDays(today, 54), scope: "all", category_ids: [], listing_ids: [], is_active: true },
    { id: "d2", name: "Electric Saver", discount_type: "fixed_per_day", value: 3, starts_on: addDays(today, -10), ends_on: addDays(today, 30), scope: "categories", category_ids: ["c-electric"], listing_ids: [], is_active: true },
    { id: "d3", name: "Green Season Women's", discount_type: "percentage", value: 10, starts_on: addDays(today, 60), ends_on: addDays(today, 90), scope: "categories", category_ids: ["c-women"], listing_ids: [], is_active: true },
    { id: "d4", name: "Easter Rides", discount_type: "percentage", value: 10, starts_on: addDays(today, -240), ends_on: addDays(today, -225), scope: "all", category_ids: [], listing_ids: [], is_active: true },
  ];

  const pickup_points: PickupPoint[] = [
    { id: "p1", name: "La Passe Jetty Kiosk", address: "Jetty road, La Passe, La Digue", latitude: -4.3567, longitude: 55.8297, opens_at: "08:00", closes_at: "18:00", instructions: "Our kiosk is on the left as you step off the ferry, beside the ox-cart stand. Show your PIN to the staff in the Ride Easy T-shirt.", is_active: true },
    { id: "p2", name: "L'Union Estate Gate", address: "L'Union Estate entrance, Anse Réunion, La Digue", latitude: -4.3697, longitude: 55.8282, opens_at: "08:30", closes_at: "17:00", instructions: "Wait at the bicycle racks just inside the main gate. Estate entry fee not included.", is_active: true },
  ];

  const hotels: Hotel[] = hotelSeeds.map(([name, lat, lng], i) => ({ id: `h${i + 1}`, name, address: "La Digue, Seychelles", latitude: lat, longitude: lng, is_active: true }));

  const settings = { ...DEFAULT_SETTINGS };
  const bookings: Booking[] = [];
  const payments: Payment[] = [];
  const email_outbox: EmailOutbox[] = [];
  const audit_log: AuditLog[] = [];
  let bikeNo = 101;

  guests.forEach(([name, , phone], i) => {
    // Spread from 3 weeks ago to 2 weeks ahead; the first 3 are today's handovers
    let start = addDays(today, Math.round(-21 + (i * 35) / guests.length));
    let nights = pick([0, 1, 2, 3, 4, 6]);
    if (i < 3) { start = today; nights = [1, 2, 0][i]; }
    if (i === 3 || i === 4) { start = addDays(today, -2); nights = 2; } // returns due today
    const end = addDays(start, nights);
    const fulfilment = i < 3 ? (["pickup", "delivery", "pickup"] as const)[i] : rand() < 0.45 ? "delivery" : "pickup";
    const method: PaymentMethod = i === 1 ? "cash" : i === 2 ? "card" : pick(["card", "card", "google_pay", "cash"]);
    const hotel = pick(hotels);
    const lineCount = rand() < 0.3 ? 2 : 1;
    const chosen = Array.from({ length: lineCount }, () => ({ listing: pick(listings), quantity: rand() < 0.35 ? 2 : 1 }));
    const time_needed = i < 3 ? ["14:00", "15:30", "16:30"][i] : pick(["08:30", "09:00", "10:00", "13:00"]);
    const created_at = new Date(new Date(fromLocalInput(`${start}T08:00`)!).getTime() - (2 + Math.floor(rand() * 10)) * 86400_000).toISOString();

    let status: BookingStatus = end < today ? "completed" : start <= today ? "with_tourist" : "confirmed";
    if (i < 3) status = "confirmed";
    if (i === 3 || i === 4) status = "with_tourist";
    if (i > 4 && i % 11 === 10) status = "cancelled";
    if (i > 4 && i % 13 === 12 && end < today) status = "no_show";

    const id = `bk${i + 1}`;
    const items: BookingItem[] = [];
    let subtotal = 0, discount_total = 0;
    for (const line of chosen) {
      const q = priceLine(line.listing, line.quantity, start, end, discounts);
      subtotal += q.gross;
      discount_total += q.discount_amount;
      for (let n = 0; n < q.quantity; n++) {
        const out = status === "with_tourist" || status === "completed";
        const assign = out || (status === "confirmed" && !(i === 2) && rand() < 0.6);
        const vendor = line.listing.category_id === "c-electric" ? vendors[3] : line.listing.category_id === "c-children" ? vendors[2] : pick(vendors.slice(0, 2));
        items.push({
          id: `${id}-${items.length + 1}`, booking_id: id, listing_id: line.listing.id, unit_price: line.listing.daily_price, days: q.days,
          discount_amount: q.discount_per_bike, line_total: q.per_bike_total, price_breakdown: { text: q.breakdown },
          vendor_id: assign ? vendor.id : null,
          commission_type: assign ? vendor.commission_type : null,
          commission_value: assign ? vendor.commission_value : null,
          commission_amount: assign ? commissionFor(vendor.commission_type, vendor.commission_value, q.per_bike_total, q.days) : null,
          bicycle_number: out ? String(bikeNo++) : null,
          condition_notes: status === "completed" ? pick(["Good", "Good", "Good", "Scratched", "Flat tyre"]) : null,
        });
      }
    }
    const delivery_fee = fulfilment === "delivery" ? settings.delivery_fee : 0;
    const total = Math.round((subtotal - discount_total + delivery_fee) * 100) / 100;
    const cash = method === "cash";
    const handed = status === "with_tourist" || status === "completed";
    const payment_status = status === "cancelled" ? (cash ? "unpaid" : "refunded") : cash ? (handed ? "paid" : status === "no_show" ? "unpaid" : "cash_due") : "paid";
    const email = `${name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}.${i + 1}@example.com`;

    const b: Booking = {
      id, reference: makeReference(rand), pin: makePin(rand), pin_attempts: 0, is_locked: false,
      pin_verified_at: handed ? fromLocalInput(`${start}T${time_needed}`) : null,
      status, payment_status, payment_method: method,
      guest_name: name, guest_phone: phone, guest_email: email, guest_passport: `P${Math.floor(10000000 + rand() * 89999999)}`,
      hotel_id: hotel.id, hotel_other_name: null, room: pick(["12", "4", "21", "Frangipani Suite", "Garden Villa 3", "108"]),
      start_date: start, end_date: end, fulfilment, pickup_point_id: fulfilment === "pickup" ? pick(pickup_points).id : null, time_needed,
      subtotal: Math.round(subtotal * 100) / 100, discount_total: Math.round(discount_total * 100) / 100, delivery_fee, total,
      cash_collected_amount: cash && handed ? total : null,
      cancellation_reason: status === "cancelled" ? "Change of travel plans" : null,
      internal_notes: null, created_at,
      handed_over_at: handed ? fromLocalInput(`${start}T${time_needed}`) : null,
      returned_at: status === "completed" ? fromLocalInput(`${end}T17:${String(10 + Math.floor(rand() * 45)).padStart(2, "0")}`) : null,
      items,
    };
    bookings.push(b);

    if (!cash && payment_status !== "unpaid") payments.push({ id: `pay${i + 1}`, booking_id: id, amount: total, method, status: payment_status === "refunded" ? "refunded" : "succeeded", provider_reference: `sim_${b.reference.slice(3).toLowerCase()}`, created_at });
    if (cash && handed) payments.push({ id: `pay${i + 1}`, booking_id: id, amount: total, method: "cash", status: "succeeded", provider_reference: "cash", created_at: b.handed_over_at! });
    email_outbox.push({ id: `em${i + 1}a`, booking_id: id, to_email: email, kind: "confirmation", created_at, ...confirmationEmail(b, settings, listings, pickup_points, hotels) });
    if (!cash && payment_status === "paid") email_outbox.push({ id: `em${i + 1}b`, booking_id: id, to_email: email, kind: "receipt", created_at, ...receiptEmail(b, settings) });
    if (handed) audit_log.push({ id: `au${i + 1}a`, actor_id: "u2", action: "handover", entity: "booking", entity_id: id, details: { bicycles: items.map((x) => x.bicycle_number) }, created_at: b.handed_over_at! });
    if (b.returned_at) audit_log.push({ id: `au${i + 1}b`, actor_id: "u2", action: "return", entity: "booking", entity_id: id, details: {}, created_at: b.returned_at });
  });

  // One upcoming booking locked after 5 wrong PINs, so the admin "Unlock PIN" action can be shown
  const toLock = bookings.find((b) => b.status === "confirmed" && b.start_date > today);
  if (toLock) Object.assign(toLock, { pin_attempts: 5, is_locked: true });

  // Easy-to-type demo bookings (see DEMO_BOOKINGS), with their emails regenerated to match
  const picks = [
    bookings.find((b) => b.id === "bk1"),
    bookings.find((b) => b.id === "bk2"),
    bookings.find((b) => b.status === "confirmed" && b.start_date >= addDays(today, 2) && !b.is_locked),
    bookings.find((b) => b.status === "completed"),
  ];
  picks.forEach((b, n) => {
    if (!b) return;
    const demo = DEMO_BOOKINGS[n];
    Object.assign(b, { reference: demo.reference, pin: demo.pin, guest_email: `${b.guest_name.split(" ")[0].toLowerCase().normalize("NFD").replace(/[^a-z]/g, "")}@example.com` });
    email_outbox.filter((e) => e.booking_id === b.id).forEach((e) => Object.assign(e, { to_email: b.guest_email },
      e.kind === "receipt" ? receiptEmail(b, settings) : confirmationEmail(b, settings, listings, pickup_points, hotels)));
  });

  return {
    version: DB_VERSION, settings, vendors, categories, listings, listing_images, discounts, pickup_points, hotels,
    bookings, payments, email_outbox, audit_log,
    users: [
      { id: "u1", email: "admin@demo.test", password: "Demo@2026", name: "Hotel Manager" },
      { id: "u2", email: "staff@demo.test", password: "Demo@2026", name: "Handover Staff" },
    ],
    user_roles: [{ user_id: "u1", role: "admin" }, { user_id: "u2", role: "handover_staff" }],
  };
}
