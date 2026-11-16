import React, { Suspense, useEffect, useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { Avatar, Button, Skeleton } from "./ui";
import { Icon, type IconName } from "./icons";
import { listNotifications } from "../lib/api";
import { slug, str } from "../lib/text";

const NAV = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/skills", label: "Discover" },
  { to: "/courses", label: "Courses" },
  { to: "/swaps", label: "Swaps" },
  { to: "/messages", label: "Messages" },
  { to: "/wallet", label: "Wallet" },
];

const MOBILE_TABS: { to: string; label: string; icon: IconName }[] = [
  { to: "/dashboard", label: "Home", icon: "home" },
  { to: "/skills", label: "Discover", icon: "compass" },
  { to: "/courses", label: "Courses", icon: "book" },
  { to: "/messages", label: "Messages", icon: "chat" },
  { to: "/wallet", label: "Wallet", icon: "wallet" },
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

/** Broadcast after notifications are marked read so the nav badge updates live. */
export const NOTIFICATIONS_CHANGED = "skillswap:notifications-changed";

function DocumentTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const match = TITLES.find(([pattern]) => pattern.test(pathname));
    document.title = match ? `${match[1]} · SkillSwap` : "SkillSwap — Teach. Learn. Swap.";
  }, [pathname]);
  return null;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
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
  const [scrolled, setScrolled] = useState(false);
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
    let cancelled = false;
    const refresh = () => {
      listNotifications(user.id)
        .then((items) => {
          if (!cancelled) setUnread(items.filter((item) => !item.read).length);
        })
        .catch(() => {
          if (!cancelled) setUnread(0);
        });
    };
    refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
    };
  }, [user, location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const primaryMobile = NAV;

  return (
    <header className={`nav ${scrolled ? "nav-scrolled" : ""}`}>
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
                <Icon name="bell" />
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
                  <Avatar name={str(user.displayName, "Member")} src={user.photoURL} size={36} />
                </button>
                {menuOpen && (
                  <div className="menu" role="menu">
                    <div className="menu-head">
                      <strong>{str(user.displayName, "Member")}</strong>
                      <span className="muted small">@{str(user.username, "member")}</span>
                      <span className="badge badge-accent" style={{ marginTop: 6, alignSelf: "flex-start" }}>
                        <Icon name="coins" size={12} /> {user.balance} Skill Coins
                      </span>
                    </div>
                    <Link className="menu-item" to={`/u/${slug(user.username)}`} role="menuitem">
                      <Icon name="user" /> My profile
                    </Link>
                    <Link className="menu-item" to="/studio" role="menuitem">
                      <Icon name="play" /> Creator studio
                    </Link>
                    <Link className="menu-item" to="/library" role="menuitem">
                      <Icon name="bookmark" /> My library
                    </Link>
                    <Link className="menu-item" to="/settings" role="menuitem">
                      <Icon name="settings" /> Settings
                    </Link>
                    {isAdmin && (
                      <Link className="menu-item" to="/admin" role="menuitem">
                        <Icon name="shield" /> Admin console
                      </Link>
                    )}
                    <div className="menu-sep" />
                    <button className="menu-item menu-item-danger" onClick={() => signOutNow()} role="menuitem">
                      <Icon name="logout" /> Sign out
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
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            onClick={() => setMobileOpen((open) => !open)}
          >
            <Icon name={mobileOpen ? "close" : "menu"} />
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav className="mobile-nav" id="mobile-nav" aria-label="Mobile">
          {user && (
            <div className="mobile-user">
              <Avatar name={str(user.displayName, "Member")} src={user.photoURL} size={30} />
              <span>
                <strong>{str(user.displayName, "Member")}</strong>
                <span className="muted">
                  @{str(user.username, "member")} · {user.balance} coins
                </span>
              </span>
            </div>
          )}
          {primaryMobile.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}
            >
              {item.label}
            </NavLink>
          ))}
          {user ? (
            <>
              <span className="mobile-nav-section">Your space</span>
              <NavLink to="/studio" className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}>
                Creator studio
              </NavLink>
              <NavLink to="/library" className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}>
                My library
              </NavLink>
              <NavLink to="/settings" className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}>
                Settings
              </NavLink>
              {isAdmin && (
                <NavLink to="/admin" className={({ isActive }) => `nav-link ${isActive ? "nav-link-active" : ""}`}>
                  Admin console
                </NavLink>
              )}
              <div className="mobile-nav-foot">
                <span className="muted small">
                  {isDemo ? "Demo mode: read-only browsing." : "Swaps and messages are always free."}
                </span>
                <Button size="sm" variant="ghost" onClick={() => signOutNow()}>
                  Sign out
                </Button>
              </div>
            </>
          ) : (
            <div className="mobile-nav-foot">
              <Link className="btn btn-secondary btn-sm" to="/login">
                Sign in
              </Link>
              <Link className="btn btn-primary btn-sm" to="/signup">
                Join SkillSwap
              </Link>
            </div>
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

function MobileTabBar() {
  return (
    <nav className="mobile-tabbar" aria-label="Primary">
      <div className="mobile-tabbar-inner">
        {MOBILE_TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            className={({ isActive }) => `mobile-tab ${isActive ? "mobile-tab-active" : ""}`}
          >
            <Icon name={tab.icon} />
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="footer-inner">
        <div>
          <Brand />
          <p className="muted small footer-brand-copy">
            Teach what you know. Learn what you don't. Swaps and messages stay free — always.
          </p>
        </div>
        <div className="footer-links">
          <Link to="/skills">Discover skills</Link>
          <Link to="/courses">Courses</Link>
          <Link to="/wallet">Skill Coins</Link>
          <Link to="/signup">Join</Link>
        </div>
        <div className="footer-meta">
          <span>© {new Date().getFullYear()} SkillSwap. A learning community, not a marketplace.</span>
          <span>Built with care · no fees on swaps</span>
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

function PageFallback() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading page">
      <div className="skeleton-stack">
        <div className="skeleton" style={{ height: 26, width: "38%" }} />
        <div className="skeleton" style={{ width: "72%" }} />
        <div className="skeleton" style={{ width: "64%" }} />
      </div>
    </div>
  );
}

export function AppShell() {
  const { user, loading } = useAuth();

  return (
    <>
      <DocumentTitle />
      <ScrollToTop />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <TopNav />
      <DataErrorBanner />
      <main className="shell" id="main">
        <Suspense fallback={<PageFallback />}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      {user && !loading && <MobileTabBar />}
      {user && !loading && <div className="tabbar-spacer" aria-hidden="true" />}
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
