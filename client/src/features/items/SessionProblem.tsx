import { Link } from 'react-router-dom';
import { authPath, sanitizeReturnTo } from '../auth-forms/authBridge';
import type { SessionProblemKind } from './sessionErrors';

interface SessionProblemProps {
  kind: SessionProblemKind;
  returnTo: string; // the page the user should come back to after signing in
  detail?: string;
  id?: string;
  className?: string;
}

export default function SessionProblem({
  kind,
  returnTo,
  detail,
  id,
  className,
}: SessionProblemProps) {
  const classes = className
    ? `item-session-problem ${className}`
    : 'item-session-problem';

  return (
    <p id={id} role="alert" className={classes}>
      {kind === 'unauthorized' ? (
        <>
          Your session has expired or you are not signed in.{' '}
          <Link to={authPath('/login', sanitizeReturnTo(returnTo))}>
            Sign in again
          </Link>
          .
        </>
      ) : (
        'You do not have permission to do this. You are still signed in.'
      )}
      {detail ? ` ${detail}` : ''}
    </p>
  );
}