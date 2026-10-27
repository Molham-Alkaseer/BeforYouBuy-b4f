import { Navigate, Outlet, useLocation } from "react-router-dom";
import LoadingMessage from "./LoadingMessage";
import { useAuth } from "../features/session/useAuth";

export default function RequireAuth() {
  const { status, user } = useAuth();
  const location = useLocation();

  if (status === "checking") {
    return <LoadingMessage message="Checking your session…" />;
  }

  if (status === "anonymous") {
    const returnTo = `${location.pathname}${location.search}${location.hash}`;
    return (
      <Navigate
        to={`/login?returnTo=${encodeURIComponent(returnTo)}`}
        replace
      />
    );
  }

  return <Outlet key={`${user?.id}:${user?.householdId}:${user?.householdRole}`} />;
}
