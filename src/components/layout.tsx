import clsx from "clsx";
import { Bike as BikeIcon, FlaskConical, Menu, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useData } from "@/hooks/useData";
import { getSettings } from "@/lib/api";
import { cartCount, useCart } from "@/lib/cart";
import { PaletteSwitcher } from "@/theme/PaletteSwitcher";

/** Brand name is a setting, e.g. "Ride Easy · Bike Rentals" → title + sub-line. */
export function useBrand() {
  const { data } = useData(getSettings);
  const [title, sub] = (data?.brand_name ?? "Ride Easy · Bike Rentals").split(/\s+·\s+/);
  return { title, sub: sub ?? "", tagline: data?.tagline ?? "", settings: data };
}

export function Logo({ onDark = false, className, sub }: { onDark?: boolean; className?: string; sub?: string }) {
  const brand = useBrand();
  return (
    <Link to="/" className={clsx("group inline-flex items-center gap-2.5", className)} aria-label={`${brand.title}, home`}>
      <span className={clsx("grid h-10 w-10 place-items-center rounded-xl transition group-hover:rotate-[-6deg]", onDark ? "bg-white/10 text-on-dark-accent" : "bg-primary text-primary-ink")}>
        <BikeIcon size={22} strokeWidth={2.2} aria-hidden />
      </span>
      <span className="leading-none">
        <span className={clsx("block font-display text-[28px] tracking-wide", onDark ? "text-white" : "text-ink")}>{brand.title}</span>
        <span className={clsx("block text-[10px] font-bold uppercase tracking-[0.28em]", onDark ? "text-white/80" : "text-ink-soft")}>{sub ?? brand.sub}</span>
      </span>
    </Link>
  );
}

const nav = [
  { to: "/bicycles", label: "Bicycles" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/my-booking", label: "Find my booking" },
];

function CartLink() {
  const n = cartCount(useCart());
  return (
    <Link to="/cart" className="relative grid h-11 w-11 place-items-center rounded-xl hover:bg-tint" aria-label={`Cart, ${n} ${n === 1 ? "bicycle" : "bicycles"}`}>
      <ShoppingBag size={22} aria-hidden />
      {n > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-cta px-1 text-xs font-bold text-cta-ink">{n}</span>}
    </Link>
  );
}

function Header() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur">
      <div className="container-page flex h-[72px] items-center justify-between gap-4">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-8 md:flex">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => clsx("text-[15px] font-medium transition hover:text-primary", isActive ? "text-primary" : "text-ink")}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-1">
          <CartLink />
          <button onClick={() => setOpen((o) => !o)} className="grid h-11 w-11 place-items-center rounded-xl hover:bg-tint md:hidden" aria-expanded={open} aria-controls="mobile-nav" aria-label={open ? "Close menu" : "Open menu"}>
            {open ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-nav" aria-label="Mobile" className="border-t border-line bg-surface md:hidden">
          <div className="container-page flex flex-col py-3">
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} className={({ isActive }) => clsx("rounded-lg px-2 py-3 text-base font-medium", isActive ? "text-primary" : "text-ink")}>{n.label}</NavLink>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}

const RIBBON_KEY = "rideeasy-ribbon-hidden";

function PrototypeRibbon() {
  const [hidden, setHidden] = useState(() => {
    try { return window.localStorage.getItem(RIBBON_KEY) === "1"; } catch { return false; }
  });
  if (hidden) return null;
  return (
    <div className="mt-8 flex items-center justify-between gap-3 rounded-xl bg-white/10 px-4 py-2.5 text-sm text-white/90">
      <span className="inline-flex items-center gap-2"><FlaskConical size={16} className="text-on-dark-accent" aria-hidden /> Prototype — demo data. Bookings, payments and emails are simulated.</span>
      <button className="rounded-md px-2 py-1 font-semibold hover:bg-white/10" onClick={() => {
        setHidden(true);
        try { window.localStorage.setItem(RIBBON_KEY, "1"); } catch { /* ignore */ }
      }}>Dismiss</button>
    </div>
  );
}

function Footer() {
  const { tagline, settings } = useBrand();
  return (
    <footer className="bg-island text-white">
      <div className="container-page py-12">
        <div className="flex flex-col justify-between gap-8 md:flex-row">
          <div>
            <Logo onDark />
            <p className="mt-5 text-white/85">{tagline}</p>
            <p className="mt-3 text-white/75">La Digue, Seychelles{settings ? ` · ${settings.contact_phone}` : ""}</p>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap gap-x-8 gap-y-3 text-[15px] font-medium">
            <Link className="hover:text-on-dark-accent" to="/bicycles">Bicycles</Link>
            <Link className="hover:text-on-dark-accent" to="/how-it-works">How it works</Link>
            <Link className="hover:text-on-dark-accent" to="/terms">Rental terms</Link>
            <Link className="hover:text-on-dark-accent" to="/staff">Staff app</Link>
            <Link className="hover:text-on-dark-accent" to="/admin">Admin</Link>
          </nav>
        </div>
        <PrototypeRibbon />
        <div className="mt-8 flex flex-col justify-between gap-2 border-t border-white/15 pt-6 text-sm text-white/80 sm:flex-row">
          <span>© {new Date().getFullYear()} {settings?.brand_name ?? "Ride Easy"}. {tagline}</span>
          <span>Made for island adventures</span>
        </div>
      </div>
    </footer>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export function PublicLayout() {
  const { pathname } = useLocation();
  return (
    <div className="flex min-h-screen flex-col">
      <ScrollToTop />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2">Skip to content</a>
      <Header />
      <main id="main" key={pathname} className="flex-1 animate-fade-in">
        <Outlet />
      </main>
      <Footer />
      {/* Bicycle pages have a fixed bar at the bottom on mobile */}
      <PaletteSwitcher raised={/^\/bicycles\/[^/]+/.test(pathname)} />
    </div>
  );
}
