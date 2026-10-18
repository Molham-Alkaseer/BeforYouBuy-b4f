import { Link, NavLink, useLocation } from 'react-router-dom';

function linkClassName(isActive: boolean): string {
  return isActive ? 'byb-nav-link byb-nav-link-active' : 'byb-nav-link';
}

export default function Navbar() {
  const { pathname } = useLocation();
  const isAddItem = pathname.replace(/\/+$/, '') === '/pantry/new';

  return (
    <aside className="byb-sidebar" aria-label="Application sidebar">
      <Link className="byb-brand" to="/" aria-label="Before You Buy home">
        <span className="byb-brand-mark" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <span>Before You Buy</span>
      </Link>

      <nav className="byb-navigation" aria-label="Main navigation">
        <NavLink to="/" end className={({ isActive }) => linkClassName(isActive)}>
          Dashboard
        </NavLink>
        <NavLink
          to="/pantry"
          aria-current={isAddItem ? false : 'page'}
          className={({ isActive }) => linkClassName(isActive && !isAddItem)}
        >
          Pantry
        </NavLink>
        <NavLink to="/shopping-list" className={({ isActive }) => linkClassName(isActive)}>
          Shopping list
        </NavLink>
        <NavLink to="/pantry/new" end className={({ isActive }) => linkClassName(isActive)}>
          Add item
        </NavLink>
      </nav>

      <p className="byb-sidebar-description">
        Know what you have, what to use first, and what you really need to buy.
      </p>
    </aside>
  );
}
