import { Bike, LogOut } from "lucide-react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { currentUser, isStaff, signOut } from "@/lib/api";
import { PaletteSwitcher } from "@/theme/PaletteSwitcher";

/** Handover staff area: phone-first, big targets, no prices, reports or settings. */
export default function StaffLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  if (!isStaff()) return <Navigate to={`/staff/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 bg-island text-white">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4">
          <Link to="/staff" className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-white/10 text-on-dark-accent"><Bike size={20} aria-hidden /></span>
            <span className="leading-none"><span className="block font-display text-2xl tracking-wide">Handover</span><span className="block text-[10px] font-bold uppercase tracking-[0.2em] text-white/75">{currentUser()?.name}</span></span>
          </Link>
          <button onClick={() => { signOut(); navigate("/staff/login"); }} className="flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold hover:bg-white/10"><LogOut size={18} aria-hidden /> Sign out</button>
        </div>
      </header>
      <main key={location.pathname} className="mx-auto max-w-2xl animate-fade-in px-4 pb-24 pt-5"><Outlet /></main>
      <PaletteSwitcher position="right" />
    </div>
  );
}
