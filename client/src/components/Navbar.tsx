import { NavLink } from 'react-router-dom';
export default function Navbar() {
 return <nav aria-label="Main navigation"><strong>Before You Buy</strong><NavLink to="/">Dashboard</NavLink><NavLink to="/pantry">Pantry</NavLink><NavLink to="/pantry/new">Add item</NavLink><NavLink to="/shopping-list">Shopping list</NavLink></nav>;
}
