import { useEffect } from "react";
import DashboardPage from "./pages/DashboardPage";
import PantryPage from "./pages/PantryPage";
import ItemFormPage from "./pages/ItemFormPage";
import ItemDetailsPage from "./pages/ItemDetailsPage";
import ShoppingListPage from "./pages/ShoppingListPage";
import NotFoundPage from "./pages/NotFoundPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { Link, Route, Routes, useLocation } from "react-router-dom";
import Footer from "./components/Footer";
import Navbar from "./components/Navbar";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";
import FamilyPage from "./pages/FamilyPage";
export default function App() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  const authPage = pathname === "/login" || pathname === "/register";
  return (
    <div className={`app-shell ${authPage ? "app-auth" : ""}`}>
      <a className="byb-skip" href="#main-content">
        Skip to content
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        {authPage && (
          <div className="byb-auth-brand">
            <Link className="byb-brand" to="/">
              B Buy
            </Link>
            <p>Know what you have. Buy what you need.</p>
          </div>
        )}
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/pantry" element={<PantryPage />} />
            <Route path="/pantry/:id" element={<ItemDetailsPage />} />
            <Route path="/shopping-list" element={<ShoppingListPage />} />
            <Route path="/history" element={<ShoppingListPage historyOnly />} />
            <Route element={<RequireAdmin />}>
              <Route path="/pantry/new" element={<ItemFormPage />} />
              <Route path="/pantry/:id/edit" element={<ItemFormPage />} />
              <Route path="/family" element={<FamilyPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
        {!authPage && <Footer />}
      </main>
    </div>
  );
}
