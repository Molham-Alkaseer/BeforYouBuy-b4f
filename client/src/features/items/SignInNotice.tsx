import { Link } from 'react-router-dom';
import { authPath, sanitizeReturnTo } from '../auth-forms/authBridge';

interface SignInNoticeProps {
  message: string;
  returnTo: string; // the page the user should come back to
  className?: string;
}

export default function SignInNotice({
  message,
  returnTo,
  className,
}: SignInNoticeProps) {
  return (
    <p className={className} role="status">
      {message}{' '}
      <Link to={authPath('/login', sanitizeReturnTo(returnTo))}>Sign in</Link>
    </p>
  );
}