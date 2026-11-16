import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="page page-narrow center-block">
      <span className="eyebrow">404</span>
      <h1>This page has moved on</h1>
      <p className="muted">The link may be old, or the page may have been removed.</p>
      <Link className="btn btn-primary" to="/">
        Back to SkillSwap
      </Link>
    </div>
  );
}
