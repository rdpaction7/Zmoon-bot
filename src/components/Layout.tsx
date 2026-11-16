import React, { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { Avatar, Button, Skeleton } from "./ui";
import { listNotifications } from "../lib/api";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/skills", label: "Discover" },
  { to: "/courses", label: "Courses" },
  { to: "/swaps", label: "Swaps" },
  { to: "/messages", label: "Messages" },
  { to: "/wallet", label: "Wallet" },
];

const TITLES: [RegExp, string][] = [
  [/^\/$/, "Teach. Learn. Swap."],
  [/^\/login/, "Sign in"],
  [/^\/signup/, "Join SkillSwap"],
  [/^\/reset/, "Reset password"],
  [/^\/dashboard/, "Dashboard"],
  [/^\/skills/, "Discover skills"],
  [/^\/courses\/.+/, "Course"],
  [/^\/courses/, "Courses"],
  [/^\/studio/, "Creator studio"],
  [/^\/library/, "Your library"],
  [/^\/swaps/, "Swaps"],
  [/^\/messages/, "Messages"],
  [/^\/wallet/, "Wallet"],
  [/^\/notifications/, "Notifications"],
  [/^\/settings/, "Settings"],
  [/^\/admin/, "Admin console"],
  [/^\/u\//, "Profile"],
];

function DocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const match = TITLES.find(([pattern]) => pattern.test(pathname));
    document.title = match ? `${match[1]} · SkillSwap` : "SkillSwap — Teach. Learn. Swap.";
  }, [pathname]);
  return null;
}

export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="SkillSwap home">
      <span className="brand-mark" aria-hidden="true">
        SS
      </span>
      <span className="brand-word">SkillSwap</span>
    </Link>
  );
}

export function TopNav() {
  const { user, isAdmin, isDemo, signOutNow } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      return;
    }
    listNotifications(user.id)
      .then((items) => setUnread(items.filter((item) => !item.read).length))
      .catch(() => setUnread(0));
  }, [user, location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuOpen]);

  return (
    <header className="nav">
      <div className="nav-inner">
        <Brand />
        <nav className="nav-links" aria-label="Main">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="nav-actions">
          {user ? (
            <>
              <Link
                to="/notifications"
                className="icon-btn"
                aria-label={`Notifications${unread > 0 ? `, ${unread} unread` : ""}`}
              >
                <span aria-hidden="true">✉</span>
                {unread > 0 && <span className="unread-dot">{unread > 9 ? "9+" : unread}</span>}
              </Link>
              <div className="menu-wrap" onClick={(event) => event.stopPropagation()}>
                <button
                  className="avatar-btn"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label="Account menu"
                >
                  <Avatar name={user.displayName} src={user.photoURL} size={34} />
                </button>
                {menuOpen && (
                  <div className="menu" role="menu">
                    <div className="menu-head">
                      <strong>{user.displayName}</strong>
                      <span className="muted small">@{user.username}</span>
                      <span className="badge badge-accent" style={{ marginTop: 6 }}>
                        {user.balance} Skill Coins
                      </span>
                    </div>
                    <Link className="menu-item" to={`/u/${user.username}`} role="menuitem">
                      My profile
                    </Link>
                    <Link className="menu-item" to="/studio" role="menuitem">
                      Creator studio
                    </Link>
                    <Link className="menu-item" to="/library" role="menuitem">
                      My library
                    </Link>
                    <Link className="menu-item" to="/settings" role="menuitem">
                      Settings
                    </Link>
                    {isAdmin && (
                      <Link className="menu-item" to="/admin" role="menuitem">
                        Admin console
                      </Link>
                    )}
                    <button
                      className="menu-item menu-item-danger"
                      onClick={() => signOutNow()}
                      role="menuitem"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <Link className="btn btn-ghost btn-sm" to="/login">
                Sign in
              </Link>
              <Link className="btn btn-primary btn-sm" to="/signup">
                Join SkillSwap
              </Link>
            </>
          )}
          <button
            className="mobile-toggle"
            aria-label="Toggle navigation"
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? "✕" : "☰"}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="mobile-nav" aria-label="Mobile">
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} className="nav-link">
              {item.label}
            </NavLink>
          ))}
          {user && (
            <>
              <NavLink to="/studio" className="nav-link">
                Creator studio
              </NavLink>
              <NavLink to="/settings" className="nav-link">
                Settings
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin" className="nav-link">
                  Admin console
                </NavLink>
              )}
            </>
          )}
        </nav>
      )}
      {isDemo && (
        <div className="demo-banner" role="status">
          Demo mode — you are browsing read-only. Create an account to sell, upload, buy or swap.
        </div>
      )}
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <Brand />
          <p className="muted small">
            Teach what you know. Learn what you don't. Swaps and messages stay free.
          </p>
        </div>
        <div className="footer-links">
          <Link to="/skills">Discover skills</Link>
          <Link to="/courses">Courses</Link>
          <Link to="/wallet">Skill Coins</Link>
          <Link to="/signup">Join</Link>
        </div>
      </div>
    </footer>
  );
}

function DataErrorBanner() {
  const { dataError } = useAuth();
  if (!dataError) return null;
  return (
    <div className="data-error" role="alert">
      <strong>Database problem</strong>
      <span>{dataError}</span>
    </div>
  );
}

export function AppShell() {
  return (
    <>
      <DocumentTitle />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <TopNav />
      <DataErrorBanner />
      <main className="shell" id="main">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}

export function ProtectedRoute({ children, admin = false }: { children: React.ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page">
        <Skeleton lines={5} />
      </div>
    );
  }
  if (!user) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  if (admin && user.role !== "admin") {
    return (
      <div className="page page-narrow">
        <div className="card card-pad">
          <h1>Admin access required</h1>
          <p className="muted">
            This area is restricted to authorised administrators. If you believe you should have
            access, ask an existing admin to grant your account the admin role.
          </p>
          <Button variant="secondary" onClick={() => window.history.back()}>
            Go back
          </Button>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
