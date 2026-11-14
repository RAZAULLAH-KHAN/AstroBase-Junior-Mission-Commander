/** AstroBase Page: NotFound — 404 fallback page with navigation back to mission control. */
import { ButtonLink } from '../components/Button';

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="panel-title">Signal lost</p>
      <h1 className="mt-2 text-3xl font-semibold">This page does not exist</h1>
      <p className="mt-3 text-muted">The link may be wrong, or the page has moved.</p>
      <ButtonLink to="/" variant="primary" className="mt-6">
        Back to mission control
      </ButtonLink>
    </div>
  );
}
