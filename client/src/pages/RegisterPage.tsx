import RegisterScreen from '../features/auth-forms/RegisterScreen';
import {
  registerAction,
  useAuthStatus,
} from '../features/auth-forms/authBridge';

export default function RegisterPage() {
  const status = useAuthStatus();
  return <RegisterScreen status={status} onRegister={registerAction} />;
}