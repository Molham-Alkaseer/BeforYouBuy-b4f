import DashboardPage from "./pages/DashboardPage";
import PantryPage from "./pages/PantryPage";
import ItemFormPage from "./pages/ItemFormPage";
import ItemDetailsPage from "./pages/ItemDetailsPage";
import ShoppingListPage from "./pages/ShoppingListPage";
import NotFoundPage from "./pages/NotFoundPage";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { Route, Routes } from "react-router-dom";
import Navbar from "./components/Navbar";
import RequireAuth from "./components/RequireAuth";
import RequireAdmin from "./components/RequireAdmin";
import FamilyPage from "./pages/FamilyPage";
export default function App() {
  return (
    <>
      <a className="byb-skip" href="#main-content">
        Skip to content
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<RequireAuth />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/pantry" element={<PantryPage />} />
            <Route path="/pantry/:id" element={<ItemDetailsPage />} />
            <Route path="/shopping-list" element={<ShoppingListPage />} />
            <Route element={<RequireAdmin />}>
              <Route path="/pantry/new" element={<ItemFormPage />} />
              <Route path="/pantry/:id/edit" element={<ItemFormPage />} />
              <Route path="/family" element={<FamilyPage />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </>
  );
}
