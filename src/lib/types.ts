/** Data model — mirrors the database tables in the SRS v0.1 prototype brief. */

export type Iso = string; // ISO UTC instant
export type DateStr = string; // "YYYY-MM-DD", Seychelles calendar date
export type TimeStr = string; // "HH:mm", Seychelles wall clock

export interface Settings {
  brand_name: string;
  tagline: string;
  currency: string;
  delivery_fee: number;
  return_time: TimeStr;
  free_cancellation_hours: number;
  booking_min_notice_hours_pickup: number;
  booking_min_notice_hours_delivery: number;
  terms_text: string;
  contact_phone: string;
  whatsapp: string;
  email: string;
}

export type CommissionType = "percentage" | "fixed_per_bike_day";

export interface Vendor {
  id: string;
  business_name: string;
  contact_person: string;
  phone: string;
  email: string;
  location_text: string;
  commission_type: CommissionType;
  commission_value: number;
  is_active: boolean;
  notes: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  sort_order: number;
}

export interface Listing {
  id: string;
  name: string;
  slug: string;
  category_id: string;
  bike_type: "standard" | "electric";
  short_description: string;
  description: string;
  features: string[];
  rider_height_min_cm: number;
  rider_height_max_cm: number;
  daily_price: number;
  /** BRL-008: how many vendors can supply per day */
  daily_limit: number;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
}

export interface ListingImage {
  id: string;
  listing_id: string;
  storage_path: string;
  is_primary: boolean;
  sort_order: number;
}

export interface Discount {
  id: string;
  name: string;
  discount_type: "percentage" | "fixed_per_day";
  value: number;
  starts_on: DateStr;
  ends_on: DateStr;
  scope: "all" | "categories" | "listings";
  /** discount_categories / discount_listings link tables, denormalised */
  category_ids: string[];
  listing_ids: string[];
  is_active: boolean;
}

export interface PickupPoint {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  opens_at: TimeStr;
  closes_at: TimeStr;
  instructions: string;
  is_active: boolean;
}

export interface Hotel {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  is_active: boolean;
}

export type BookingStatus = "awaiting_payment" | "confirmed" | "with_tourist" | "completed" | "cancelled" | "no_show";
export type PaymentStatus = "unpaid" | "paid" | "cash_due" | "refunded";
export type PaymentMethod = "card" | "google_pay" | "cash";
export type Fulfilment = "pickup" | "delivery";

export interface BookingItem {
  id: string;
  booking_id: string;
  listing_id: string;
  unit_price: number;
  days: number;
  discount_amount: number;
  line_total: number;
  price_breakdown: { text: string };
  vendor_id: string | null;
  /** BRL-012: commission snapshot taken when the vendor is assigned */
  commission_type: CommissionType | null;
  commission_value: number | null;
  commission_amount: number | null;
  bicycle_number: string | null;
  condition_notes: string | null;
}

export interface Booking {
  id: string;
  reference: string;
  pin: string;
  pin_attempts: number;
  is_locked: boolean;
  pin_verified_at: Iso | null;
  status: BookingStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  guest_name: string;
  guest_phone: string;
  guest_email: string;
  guest_passport: string;
  hotel_id: string | null;
  hotel_other_name: string | null;
  room: string;
  start_date: DateStr;
  end_date: DateStr;
  fulfilment: Fulfilment;
  pickup_point_id: string | null;
  time_needed: TimeStr;
  subtotal: number;
  discount_total: number;
  delivery_fee: number;
  total: number;
  cash_collected_amount: number | null;
  cancellation_reason: string | null;
  internal_notes: string | null;
  created_at: Iso;
  handed_over_at: Iso | null;
  returned_at: Iso | null;
  /** One row per bicycle (a cart line of 3 bikes becomes 3 items, each with its own number at handover). */
  items: BookingItem[];
}

export interface Payment {
  id: string;
  booking_id: string;
  amount: number;
  method: PaymentMethod;
  status: "succeeded" | "failed" | "refunded";
  provider_reference: string;
  created_at: Iso;
}

export interface EmailOutbox {
  id: string;
  booking_id: string;
  to_email: string;
  subject: string;
  body_html: string;
  kind: "confirmation" | "receipt" | "cancellation" | "reminder";
  created_at: Iso;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  action: string;
  entity: string;
  entity_id: string;
  details: Record<string, unknown>;
  created_at: Iso;
}

export type Role = "admin" | "handover_staff";

export interface User {
  id: string;
  email: string;
  password: string; // prototype only
  name: string;
}

export interface UserRole {
  user_id: string;
  role: Role;
}

export interface Database {
  version: number;
  settings: Settings;
  vendors: Vendor[];
  categories: Category[];
  listings: Listing[];
  listing_images: ListingImage[];
  discounts: Discount[];
  pickup_points: PickupPoint[];
  hotels: Hotel[];
  bookings: Booking[];
  payments: Payment[];
  email_outbox: EmailOutbox[];
  audit_log: AuditLog[];
  users: User[];
  user_roles: UserRole[];
}
