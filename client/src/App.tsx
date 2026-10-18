import { Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import DashboardPage from './pages/DashboardPage';
import PantryPage from './pages/PantryPage';
import ItemFormPage from './pages/ItemFormPage';
import ItemDetailsPage from './pages/ItemDetailsPage';
import ShoppingListPage from './pages/ShoppingListPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <div className="byb-app">
      <a className="byb-skip-link" href="#main-content">Skip to main content</a>
      <Navbar />
      <main className="byb-main" id="main-content" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/pantry" element={<PantryPage />} />
          <Route path="/pantry/new" element={<ItemFormPage />} />
          <Route path="/pantry/:id" element={<ItemDetailsPage />} />
          <Route path="/pantry/:id/edit" element={<ItemFormPage />} />
          <Route path="/shopping-list" element={<ShoppingListPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
    </div>
  );
}
