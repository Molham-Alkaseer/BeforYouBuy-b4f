import { NavLink, Link, useLocation } from "react-router-dom";
import { useAuth } from "../features/session/useAuth";
import Icon from "./Icon";

export default function Navbar() {
  const { pathname } = useLocation();
  const { status, user, logout } = useAuth();
  const canManage =
    status === "authenticated" &&
    (user?.householdRole === "admin" || user?.householdRole === "owner");
  if (pathname === "/login" || pathname === "/register") return null;
  const shopping = pathname === "/shopping-list";
  return (
    <>
      <header className="byb-topbar">
        <div className="byb-topbar-inner">
          <Link to="/" className="byb-brand" aria-label="B Buy home">
            B Buy
          </Link>
          <nav className="byb-desktop-nav" aria-label="Main navigation">
            <NavLink to="/" end>
              Dashboard
            </NavLink>
            <NavLink to="/pantry" end={pathname === "/pantry/new"}>
              Pantry
            </NavLink>
            <NavLink to="/shopping-list">Shopping</NavLink>
            <NavLink to="/about">About us</NavLink>
          </nav>
          <div className="byb-topbar-actions">
            {canManage && (
              <Link
                className="byb-button byb-header-add"
                to={shopping ? "/shopping-list?add=manual" : "/pantry/new"}
              >
                <Icon name="plus" />
                {shopping ? "Add Manual Entry" : "Add Item"}
              </Link>
            )}
            {status === "authenticated" && user ? (
              <details className="byb-account">
                <summary aria-label="Account menu">
                  <span className="byb-avatar" aria-hidden="true">
                    {user.name
                      .trim()
                      .split(/\s+/)
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")}
                  </span>
                  <span className="byb-account-name">
                    <strong>{user.name}</strong>
                    <small>
                      {user.householdRole === "member" ? "Member" : "Admin"}
                    </small>
                  </span>
                </summary>
                <div className="byb-account-menu">
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                  {canManage && (
                    <Link
                      to="/family"
                      onClick={(event) =>
                        event.currentTarget
                          .closest("details")
                          ?.removeAttribute("open")
                      }
                    >
                      <Icon name="users" />
                      Family members
                    </Link>
                  )}
                  <button type="button" onClick={logout}>
                    <Icon name="logout" />
                    Sign out
                  </button>
                </div>
              </details>
            ) : (
              <Link className="byb-button" to="/login">
                Sign in
              </Link>
            )}
          </div>
        </div>
      </header>
      {status === "authenticated" && (
        <nav
          className={`byb-bottom-nav ${canManage ? "with-add" : ""}`}
          aria-label="Mobile navigation"
        >
          <NavLink to="/" end>
            <Icon name="home" />
            <span>Home</span>
          </NavLink>
          <NavLink to="/pantry">
            <Icon name="pantry" />
            <span>Pantry</span>
          </NavLink>
          {canManage && (
            <Link
              className="byb-mobile-add"
              to="/pantry/new"
              aria-label="Add item"
            >
              <Icon name="plus" />
            </Link>
          )}
          <NavLink to="/shopping-list">
            <Icon name="basket" />
            <span>List</span>
          </NavLink>
          <NavLink to="/history">
            <Icon name="history" />
            <span>History</span>
          </NavLink>
        </nav>
      )}
    </>
  );
}
