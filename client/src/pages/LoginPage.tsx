import LoginScreen from '../features/auth-forms/LoginScreen';
import { loginAction, useAuthStatus } from '../features/auth-forms/authBridge';

export default function LoginPage() {
  const status = useAuthStatus();
  return <LoginScreen status={status} onLogin={loginAction} />;
}