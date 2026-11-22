import { zodResolver } from "@hookform/resolvers/zod";
import { KeyRound, LogIn } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Logo } from "@/components/layout";
import { Alert, Button, Field } from "@/components/ui";
import { ApiError, isAdmin, isStaff, signIn } from "@/lib/api";
import { PaletteSwitcher } from "@/theme/PaletteSwitcher";

const schema = z.object({ email: z.string().trim().email("Please enter a valid email."), password: z.string().min(1, "Please enter your password.") });
type Values = z.infer<typeof schema>;

/** One sign-in page for both areas; each role lands where it belongs. */
export default function Login({ area }: { area: "admin" | "staff" }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(schema) });
  const next = params.get("next");

  if (area === "admin" && isAdmin()) return <Navigate to={next?.startsWith("/admin") ? next : "/admin"} replace />;
  if (area === "staff" && isStaff()) return <Navigate to={next?.startsWith("/staff") ? next : "/staff"} replace />;

  async function onSubmit(v: Values) {
    setError(null);
    try {
      const roles = await signIn(v.email, v.password);
      if (area === "admin" && !roles.includes("admin")) return navigate("/staff", { replace: true });
      navigate(next?.startsWith(`/${area}`) ? next : `/${area}`, { replace: true });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't sign in. Please try again.");
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-island lg:block">
        <img src="/images/hero-beach.jpg" alt="" className="absolute inset-0 h-full w-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-island via-island/40 to-transparent" />
        <div className="absolute bottom-12 left-12 right-12 text-white">
          <p className="font-display text-6xl uppercase leading-none">{area === "admin" ? <>Run your rentals<br />without a developer</> : <>Fast handovers<br />at the jetty</>}</p>
          <p className="mt-3 text-lg text-white/85">{area === "admin" ? "Bicycles, vendors, prices, bookings and reports in one place." : "Check the PIN, record bicycle numbers, collect cash."}</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <Logo />
          <h1 className="h-display mt-10 text-5xl">{area === "admin" ? "Admin" : "Handover staff"}</h1>
          <p className="mt-1 text-ink-soft">Sign in to continue.</p>
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 space-y-5">
            <Field label="Email" htmlFor="email" error={errors.email?.message}><input id="email" type="email" autoComplete="username" className="field" {...register("email")} aria-invalid={!!errors.email} /></Field>
            <Field label="Password" htmlFor="password" error={errors.password?.message}><input id="password" type="password" autoComplete="current-password" className="field" {...register("password")} aria-invalid={!!errors.password} /></Field>
            {error && <Alert>{error}</Alert>}
            <Button type="submit" size="lg" className="w-full" loading={isSubmitting}><LogIn size={18} /> Sign in</Button>
          </form>
          <div className="mt-6 rounded-xl border border-dashed border-line bg-surface p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold"><KeyRound size={16} className="text-primary" aria-hidden /> Demo credentials (password Demo@2026)</p>
            <p className="mt-1 text-ink-soft">Admin: <span className="font-mono text-ink">admin@demo.test</span></p>
            <p className="text-ink-soft">Handover staff: <span className="font-mono text-ink">staff@demo.test</span></p>
          </div>
          <p className="mt-4 text-sm text-ink-soft">{area === "admin" ? <>Handover staff? <Link to="/staff/login" className="link">Use the staff app</Link></> : <>Admin? <Link to="/admin/login" className="link">Admin sign-in</Link></>}</p>
        </div>
      </div>
      <PaletteSwitcher />
    </div>
  );
}
