import {
  Navigate,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router-dom";
import LoginForm from "./LoginForm";
import { authPath, sanitizeReturnTo } from "./authBridge";
import type { AuthStatus } from "./authBridge";
import type { LoginValues } from "./authTypes";
import "./auth-forms.css";

interface LoginScreenProps {
  status: AuthStatus;
  onLogin: (input: LoginValues) => Promise<void>;
}

export default function LoginScreen({ status, onLogin }: LoginScreenProps) {
  const [params] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();

  const returnTo = sanitizeReturnTo(params.get("returnTo"));

  // The register page may hand over an email through the route state (never a password).
  const state = location.state as { email?: unknown } | null;
  const initialEmail = typeof state?.email === "string" ? state.email : "";

  // Already signed in: go straight on. returnTo never points back here, so no loop.
  if (status === "authenticated") {
    return <Navigate to={returnTo} replace />;
  }
  if (status === "checking")
    return <p role="status">Checking your session...</p>;

  return (
    <section className="auth-page">
      <h1>Welcome Back</h1>
      <p className="auth-intro">
        Sign in to access your pantry and shopping list.
      </p>

      <LoginForm
        onLogin={onLogin}
        onSuccess={() => navigate(returnTo, { replace: true })}
        registerPath={authPath("/register", returnTo)}
        initialEmail={initialEmail}
      />
    </section>
  );
}
