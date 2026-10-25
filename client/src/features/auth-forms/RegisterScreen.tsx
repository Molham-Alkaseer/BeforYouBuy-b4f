import { Navigate, useSearchParams } from 'react-router-dom';
import RegisterForm from './RegisterForm';
import { authPath, sanitizeReturnTo } from './authBridge';
import type { AuthStatus } from './authBridge';
import type { RegisterValues } from './authTypes';
import './auth-forms.css';

interface RegisterScreenProps {
  status: AuthStatus;
  onRegister: (input: RegisterValues) => Promise<unknown>;
}

export default function RegisterScreen({
  status,
  onRegister,
}: RegisterScreenProps) {
  const [params] = useSearchParams();
  const returnTo = sanitizeReturnTo(params.get('returnTo'));

  if (status === 'authenticated') {
    return <Navigate to={returnTo} replace />;
  }
  if (status === 'checking') return <p role="status">Checking your session...</p>;

  return (
    <section className="auth-page">
      <h1>Create your account</h1>
      <p className="auth-intro">Create your own household as its admin. You can then add family members with read-only access.</p>

      <RegisterForm
        onRegister={onRegister}
        loginPath={authPath('/login', returnTo)}
      />
    </section>
  );
}
