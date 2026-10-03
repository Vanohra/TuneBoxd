import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <section className="narrow center card">
      <h1 className="page-title">Page not found</h1>
      <p>This track doesn’t exist, or it was removed from the album.</p>
      <Link to="/" className="btn btn-outline">
        Back to home
      </Link>
    </section>
  );
}
