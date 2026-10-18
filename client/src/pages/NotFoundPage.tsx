import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="byb-not-found" aria-labelledby="not-found-title">
      <p className="byb-eyebrow">404 / PAGE NOT FOUND</p>
      <h1 id="not-found-title">Page not found</h1>
      <p>The page may have moved, or the address may be incorrect.</p>
      <div className="byb-actions">
        <Link className="byb-button byb-button-primary" to="/">Go to dashboard</Link>
        <Link className="byb-button byb-button-secondary" to="/pantry">Open pantry</Link>
      </div>
    </section>
  );
}
