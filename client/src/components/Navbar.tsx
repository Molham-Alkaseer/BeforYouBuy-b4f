import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../features/session/useAuth";

export default function Navbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { status, user, logout } = useAuth();
  const addItemTo =
    status !== "anonymous"
      ? "/pantry/new"
      : `/login?${new URLSearchParams({ returnTo: "/pantry/new" })}`;

  function signOut() {
    logout();
    if (
      pathname === "/pantry/new" ||
      /^\/pantry\/[^/]+\/edit$/.test(pathname)
    ) {
      navigate("/pantry", { replace: true });
    }
  }

  return (
    <aside className="byb-sidebar">
      <NavLink to="/" className="byb-brand">
        <span aria-hidden="true">✓</span>Before You Buy
      </NavLink>
      <nav aria-label="Main navigation">
        <NavLink to="/" end>
          Dashboard
        </NavLink>
        <NavLink to="/pantry" end={pathname === "/pantry/new"}>
          Pantry
        </NavLink>
        <NavLink to="/shopping-list">Shopping list</NavLink>
        <NavLink to={addItemTo}>Add item</NavLink>
        {status === "anonymous" && (
          <>
            <NavLink to="/login">Sign in</NavLink>
            <NavLink to="/register">Register</NavLink>
          </>
        )}
      </nav>
      {status === "authenticated" && user && (
        <div className="byb-session">
          <span className="byb-session-name" title={user.name}>
            {user.name}
          </span>
          <span className="byb-session-role">{user.householdRole}</span>
          <button className="byb-sign-out" type="button" onClick={signOut}>
            Sign out
          </button>
        </div>
      )}
      <p>
        Know what you have, what to use first, and what you really need to buy.
      </p>
    </aside>
  );
}
