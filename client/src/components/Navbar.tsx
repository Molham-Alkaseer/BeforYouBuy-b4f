import { NavLink, useLocation } from 'react-router-dom';
export default function Navbar() {
 const { pathname } = useLocation();
 return <aside className="byb-sidebar">
   <NavLink to="/" className="byb-brand"><span aria-hidden="true">✓</span>Before You Buy</NavLink>
   <nav aria-label="Main navigation">
     <NavLink to="/" end>Dashboard</NavLink>
     <NavLink to="/pantry" end={pathname === '/pantry/new'}>Pantry</NavLink>
     <NavLink to="/shopping-list">Shopping list</NavLink>
     <NavLink to="/pantry/new">Add item</NavLink>
   </nav>
   <p>Know what you have, what to use first, and what you really need to buy.</p>
 </aside>;
}
