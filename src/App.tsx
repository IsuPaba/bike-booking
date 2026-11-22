import { lazy, Suspense } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { PublicLayout } from "./components/layout";
import { Skeleton } from "./components/ui";
import BicycleDetail from "./pages/BicycleDetail";
import Bicycles from "./pages/Bicycles";
import CartPage from "./pages/Cart";
import Confirmation from "./pages/Confirmation";
import Home from "./pages/Home";
import MyBooking from "./pages/MyBooking";
import NotFound from "./pages/NotFound";
import { HowItWorks, Terms } from "./pages/simple";

// Checkout/payment pull in maps and forms; staff and admin load only when opened
const Checkout = lazy(() => import("./pages/Checkout"));
const Pay = lazy(() => import("./pages/Pay"));
const Login = lazy(() => import("./admin/Login"));
const StaffLayout = lazy(() => import("./staff/StaffLayout"));
const StaffToday = lazy(() => import("./staff/StaffToday"));
const StaffHandover = lazy(() => import("./staff/StaffHandover"));
const StaffReturn = lazy(() => import("./staff/StaffReturn"));
const AdminLayout = lazy(() => import("./admin/AdminLayout"));
const Dashboard = lazy(() => import("./admin/Dashboard"));
const BookingsAdmin = lazy(() => import("./admin/BookingsAdmin"));
const BookingDetail = lazy(() => import("./admin/BookingDetail"));
const ListingsAdmin = lazy(() => import("./admin/ListingsAdmin"));
const ListingForm = lazy(() => import("./admin/ListingForm"));
const CategoriesAdmin = lazy(() => import("./admin/CategoriesAdmin"));
const VendorsAdmin = lazy(() => import("./admin/VendorsAdmin"));
const VendorDetail = lazy(() => import("./admin/VendorsAdmin").then((m) => ({ default: m.VendorDetail })));
const DiscountsAdmin = lazy(() => import("./admin/DiscountsAdmin"));
const LocationsAdmin = lazy(() => import("./admin/LocationsAdmin"));
const ReportsAdmin = lazy(() => import("./admin/ReportsAdmin"));
const EmailsAdmin = lazy(() => import("./admin/EmailsAdmin"));
const UsersAdmin = lazy(() => import("./admin/UsersAdmin"));
const SettingsAdmin = lazy(() => import("./admin/SettingsAdmin"));
const DemoGuide = lazy(() => import("./admin/DemoGuide"));

const loading = <div className="p-8"><Skeleton className="h-96 rounded-2xl" /></div>;

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={loading}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<Home />} />
            <Route path="bicycles" element={<Bicycles />} />
            <Route path="bicycles/:slug" element={<BicycleDetail />} />
            <Route path="bikes/*" element={<Navigate to="/bicycles" replace />} />
            <Route path="cart" element={<CartPage />} />
            <Route path="checkout" element={<Checkout />} />
            <Route path="pay/:reference" element={<Pay />} />
            <Route path="booking/:reference" element={<Confirmation />} />
            <Route path="my-booking" element={<MyBooking />} />
            <Route path="how-it-works" element={<HowItWorks />} />
            <Route path="terms" element={<Terms />} />
            <Route path="*" element={<NotFound />} />
          </Route>

          <Route path="staff/login" element={<Login area="staff" />} />
          <Route path="staff" element={<StaffLayout />}>
            <Route index element={<StaffToday />} />
            <Route path="booking/:id" element={<StaffHandover />} />
            <Route path="booking/:id/return" element={<StaffReturn />} />
          </Route>

          <Route path="admin/login" element={<Login area="admin" />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Dashboard />} />
            <Route path="bookings" element={<BookingsAdmin />} />
            <Route path="bookings/:id" element={<BookingDetail />} />
            <Route path="bicycles" element={<ListingsAdmin />} />
            <Route path="bicycles/new" element={<ListingForm />} />
            <Route path="bicycles/:id" element={<ListingForm />} />
            <Route path="categories" element={<CategoriesAdmin />} />
            <Route path="vendors" element={<VendorsAdmin />} />
            <Route path="vendors/:id" element={<VendorDetail />} />
            <Route path="discounts" element={<DiscountsAdmin />} />
            <Route path="locations" element={<LocationsAdmin />} />
            <Route path="reports" element={<ReportsAdmin />} />
            <Route path="emails" element={<EmailsAdmin />} />
            <Route path="users" element={<UsersAdmin />} />
            <Route path="settings" element={<SettingsAdmin />} />
            <Route path="demo-guide" element={<DemoGuide />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
