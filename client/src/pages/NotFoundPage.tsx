import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return <section className="byb-panel"><p>404</p><h1>Page not found</h1><p>This page does not exist. Return to your dashboard or browse your pantry.</p><Link className="byb-button" to="/">Back to dashboard</Link></section>;
}
