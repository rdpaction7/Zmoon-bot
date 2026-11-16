import { Link } from "react-router-dom";
import { Icon } from "../components/icons";

export default function NotFound() {
  return (
    <div className="page page-narrow">
      <div className="card card-pad center-block" style={{ padding: "3.5rem 2rem" }}>
        <span className="empty-icon" aria-hidden="true">
          <Icon name="compass" />
        </span>
        <span className="eyebrow" style={{ marginBottom: 0 }}>Error 404</span>
        <h1>This page has moved on</h1>
        <p className="muted">The link may be old, or the page may have been removed.</p>
        <div className="row wrap" style={{ justifyContent: "center" }}>
          <Link className="btn btn-primary" to="/">
            Back to SkillSwap
          </Link>
          <Link className="btn btn-secondary" to="/courses">
            Browse courses
          </Link>
          <Link className="btn btn-ghost" to="/skills">
            Discover skills
          </Link>
        </div>
      </div>
    </div>
  );
}
