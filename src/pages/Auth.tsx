import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { Button, ErrorText, Field, Input, useToast } from "../components/ui";
import { Icon } from "../components/icons";

const FRIENDLY: Record<string, string> = {
  "auth/invalid-email": "That email address does not look right.",
  "auth/missing-password": "Please enter your password.",
  "auth/weak-password": "Passwords need at least 6 characters.",
  "auth/email-already-in-use": "An account with this email already exists. Try signing in.",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/user-not-found": "No account matches that email.",
  "auth/too-many-requests": "Too many attempts. Wait a moment and try again.",
  "auth/network-request-failed": "Network problem — check your connection and try again.",
  "auth/operation-not-allowed":
    "This sign-in method is disabled in the Firebase project. Enable it in Authentication → Sign-in method.",
  "auth/admin-restricted-operation":
    "Anonymous sign-in is disabled. Enable Anonymous in Firebase Authentication to use the demo.",
};

function friendly(error: any): string {
  return FRIENDLY[error?.code] || error?.message || "Something went wrong. Please try again.";
}

export default function Auth({ mode }: { mode: "login" | "signup" | "reset" }) {
  const { signUp, signIn, resetPassword, startDemo } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { push } = useToast();
  const rawNext = params.get("next") || "/dashboard";
  // Only allow same-origin, path-based redirects (no //evil.example open redirects).
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");

    if (mode === "signup") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setError("Enter a valid email address.");
      if (password.length < 8) return setError("Use at least 8 characters for your password.");
      if (password !== confirm) return setError("Those passwords do not match.");
      if (!/^[a-zA-Z0-9_]{3,24}$/.test(username))
        return setError("Usernames are 3–24 characters: letters, numbers and underscores only.");
      if (!displayName.trim()) return setError("Add the name you want to be known by.");
    }

    setBusy(true);
    try {
      if (mode === "login") {
        await signIn(email, password);
        push("Welcome back.", "success");
        navigate(next, { replace: true });
      } else if (mode === "signup") {
        await signUp({ email, password, username, displayName: displayName.trim() });
        push("Your account is ready. Welcome to SkillSwap.", "success");
        navigate("/dashboard", { replace: true });
      } else {
        await resetPassword(email);
        push("Password reset email sent — check your inbox.", "success");
      }
    } catch (caught: any) {
      setError(friendly(caught));
    } finally {
      setBusy(false);
    }
  }

  async function demo() {
    setError("");
    setDemoBusy(true);
    try {
      await startDemo();
      push("Browsing as a demo visitor — everything is read-only.", "info");
      navigate("/dashboard", { replace: true });
    } catch (caught: any) {
      setError(friendly(caught));
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <aside className="auth-aside">
          <span className="eyebrow">A learning community</span>
          <h2>
            Teach what you know.
            <br />
            Learn what you <em>don't</em>.
          </h2>
          <p className="muted">
            Swap skills one-to-one for free, or publish a course and let learners come to you. No
            subscriptions, no fees on conversations.
          </p>
          <div className="auth-aside-features">
            <div className="auth-aside-feature">
              <span className="auth-aside-feature-icon">
                <Icon name="swap" />
              </span>
              <div>
                <strong>Swaps stay free</strong>
                <span>Coins only ever price paid courses — never a conversation.</span>
              </div>
            </div>
            <div className="auth-aside-feature">
              <span className="auth-aside-feature-icon">
                <Icon name="shield" />
              </span>
              <div>
                <strong>Your work is yours</strong>
                <span>Courses, files and reviews stay with the member who made them.</span>
              </div>
            </div>
            <div className="auth-aside-feature">
              <span className="auth-aside-feature-icon">
                <Icon name="sparkles" />
              </span>
              <div>
                <strong>Honest by default</strong>
                <span>Real numbers, human moderation and no invented progress.</span>
              </div>
            </div>
          </div>
        </aside>

        <div className="auth-card card card-pad">
        <h1>
          {mode === "login" ? "Welcome back" : mode === "signup" ? "Join SkillSwap" : "Reset password"}
        </h1>
        <p className="muted small">
          {mode === "login"
            ? "Sign in to keep teaching, learning and swapping."
            : mode === "signup"
              ? "Your first 10 Skill Coins are on us."
              : "We will email you a secure link to choose a new password."}
        </p>

        <form onSubmit={submit} className="form-grid" noValidate>
          <Field label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>

          {mode === "signup" && (
            <>
              <Field label="Display name" htmlFor="displayName" hint="Shown on your profile and courses.">
                <Input
                  id="displayName"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
              </Field>
              <Field label="Username" htmlFor="username" hint="Letters, numbers and underscores. 3–24 characters.">
                <Input
                  id="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                />
              </Field>
            </>
          )}

          {mode !== "reset" && (
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </Field>
          )}

          {mode === "signup" && (
            <Field label="Confirm password" htmlFor="confirm">
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </Field>
          )}

          <ErrorText>{error}</ErrorText>

          <Button type="submit" loading={busy}>
            {mode === "login" ? "Sign in" : mode === "signup" ? "Create account" : "Send reset link"}
          </Button>
        </form>

        <div className="auth-foot">
          {mode === "login" && (
            <>
              <Link to="/reset">Forgot your password?</Link>
              <span className="muted">·</span>
              <Link to="/signup">Create an account</Link>
            </>
          )}
          {mode === "signup" && (
            <>
              <span className="muted">Already a member?</span>
              <Link to="/login">Sign in</Link>
            </>
          )}
          {mode === "reset" && <Link to="/login">Back to sign in</Link>}
        </div>

        <div className="divider" />

        <Button variant="secondary" onClick={demo} loading={demoBusy} disabled={busy} className="full">
          Explore the demo (read-only)
        </Button>
        <p className="muted small center">
          Demo visitors can browse and open free courses but cannot sell, upload, buy or swap.
        </p>
        </div>
      </div>
    </div>
  );
}
