import { useEffect, useState } from "react";
import { useAuth } from "../state/AuthContext";
import { updateProfile } from "../lib/api";
import { useGithubSettings } from "../lib/settings";
import {
  isGithubConfigured,
  listMedia,
  storageStats,
  uploadServiceHealth,
  verifyConnection,
} from "../lib/github";
import { GITHUB_CONFIG } from "../App";
import {
  Badge,
  Avatar,
  Button,
  Card,
  ErrorText,
  Field,
  Input,
  Progress,
  Tabs,
  Textarea,
  useToast,
} from "../components/ui";

export default function Settings() {
  const { user, refreshProfile, isDemo } = useAuth();
  const { push } = useToast();
  const { settings, save } = useGithubSettings(GITHUB_CONFIG);

  const [tab, setTab] = useState("profile");
  const [form, setForm] = useState({
    displayName: "",
    bio: "",
    location: "",
    photoURL: "",
    goals: "",
    interests: "",
    skillsWanted: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const [gh, setGh] = useState(settings);
  const [ghBusy, setGhBusy] = useState(false);
  const [ghError, setGhError] = useState("");
  const [ghStatus, setGhStatus] = useState<{ login: string; repo: string; canPush: boolean } | null>(null);
  const [stats, setStats] = useState<{ latestRelease: string | null; assetCount: number; maxAssets: number } | null>(null);
  const [service, setService] = useState<string>("");
  const [assets, setAssets] = useState<{ name: string; url: string; size: number; releaseTag: string }[]>([]);

  useEffect(() => {
    if (!user) return;
    setForm({
      displayName: user.displayName || "",
      bio: user.bio || "",
      location: user.location || "",
      photoURL: user.photoURL || "",
      goals: user.goals || "",
      interests: (user.interests || []).join(", "),
      skillsWanted: (user.skillsWanted || []).join(", "),
    });
  }, [user]);

  useEffect(() => {
    setGh(settings);
  }, [settings]);

  if (!user) return null;

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (form.displayName.trim().length < 2) return setError("Add a display name.");
    setBusy(true);
    try {
      await updateProfile(user!.id, {
        displayName: form.displayName.trim(),
        bio: form.bio.trim().slice(0, 500),
        location: form.location.trim().slice(0, 80),
        photoURL: form.photoURL.trim(),
        goals: form.goals.trim().slice(0, 400),
        interests: form.interests.split(",").map((v) => v.trim()).filter(Boolean).slice(0, 12),
        skillsWanted: form.skillsWanted.split(",").map((v) => v.trim()).filter(Boolean).slice(0, 12),
      });
      await refreshProfile();
      push("Profile updated.", "success");
    } catch (caught: any) {
      setError(caught?.message || "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }

  function saveStorage(event: React.FormEvent) {
    event.preventDefault();
    if (!gh.token.trim()) return setGhError("Paste a fine-grained token with Contents: read & write.");
    if (!gh.owner.trim() || !gh.repo.trim()) return setGhError("Owner and repository are required.");
    if (!/^https?:\/\//.test(gh.uploadUrl.trim())) return setGhError("Upload service URL must start with http(s)://");
    setGhError("");
    save({
      token: gh.token.trim(),
      owner: gh.owner.trim(),
      repo: gh.repo.trim(),
      prefix: gh.prefix.trim() || "skillswap-media",
      maxAssets: Math.max(1, Math.min(1000, Number(gh.maxAssets) || 1000)),
      uploadUrl: gh.uploadUrl.trim().replace(/\/$/, ""),
    });
    push("Storage settings saved in this browser.", "success");
  }

  async function testEverything() {
    setGhError("");
    setService("");
    setGhBusy(true);
    // Test what is currently in the form, not the last saved values.
    const candidate = {
      token: gh.token.trim(),
      owner: gh.owner.trim(),
      repo: gh.repo.trim(),
      prefix: gh.prefix.trim() || "skillswap-media",
      maxAssets: Math.max(1, Math.min(1000, Number(gh.maxAssets) || 1000)),
      uploadUrl: gh.uploadUrl.trim().replace(/\/$/, ""),
    };
    try {
      const [serviceResult, connection] = await Promise.allSettled([
        uploadServiceHealth(candidate),
        verifyConnection(candidate),
      ]);
      if (serviceResult.status === "fulfilled") {
        setService(
          `Upload service online${serviceResult.value.repository ? ` (${serviceResult.value.repository})` : ""}.`,
        );
      } else {
        setService("Upload service unreachable — it may be waking up. Try again in ~30s.");
      }
      if (connection.status === "fulfilled") {
        setGhStatus(connection.value);
        const [storage, media] = await Promise.all([
          storageStats(candidate).catch(() => null),
          listMedia(candidate, 12).catch(() => []),
        ]);
        if (storage) setStats(storage);
        setAssets(media);
      } else {
        const reason: any = connection.reason;
        setGhError(
          reason?.status === 401
            ? "GitHub rejected the token (401). Check it is valid, not expired, and has Contents access."
            : reason?.message || "Could not reach GitHub.",
        );
      }
    } finally {
      setGhBusy(false);
    }
  }

  return (
    <div className="page page-narrow">
      <header className="section-head">
        <span className="eyebrow">Settings</span>
        <h1>Your account</h1>
        <p className="muted">Profile details, media storage and how your data is stored.</p>
      </header>

      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "profile", label: "Profile" },
          { id: "storage", label: "Media storage" },
        ]}
      />

      {tab === "profile" && (
        <Card className="card-pad">
          <div className="between">
            <h2>Public profile</h2>
            <Badge tone={isDemo ? "warning" : "positive"}>{isDemo ? "demo · read-only" : "live"}</Badge>
          </div>
          {isDemo && <p className="muted small">Demo accounts are read-only — changes will not be saved.</p>}
          <div className="row" style={{ alignItems: "flex-start" }}>
            <Avatar
              name={form.displayName || user.displayName || "Member"}
              src={form.photoURL || user.photoURL}
              size={56}
            />
            <div style={{ minWidth: 0 }}>
              <strong>{form.displayName || "Your name"}</strong>
              <p className="muted small" style={{ margin: 0 }}>
                {form.bio ? form.bio.slice(0, 120) : "Add a short bio so members know what you teach."}
              </p>
            </div>
          </div>
          <form className="form-grid" onSubmit={saveProfile}>
            <Field label="Display name">
              <Input value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
            </Field>
            <Field label="Bio" hint="Up to 500 characters.">
              <Textarea rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
            </Field>
            <div className="form-row">
              <Field label="Location (optional)">
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </Field>
              <Field label="Profile photo URL (optional)">
                <Input value={form.photoURL} onChange={(e) => setForm({ ...form, photoURL: e.target.value })} />
              </Field>
            </div>
            <Field label="Interests" hint="Comma separated.">
              <Input value={form.interests} onChange={(e) => setForm({ ...form, interests: e.target.value })} />
            </Field>
            <Field label="Skills you want to learn" hint="Comma separated.">
              <Input
                value={form.skillsWanted}
                onChange={(e) => setForm({ ...form, skillsWanted: e.target.value })}
              />
            </Field>
            <Field label="Learning goals">
              <Textarea rows={3} value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} />
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" loading={busy} disabled={isDemo}>
              Save profile
            </Button>
          </form>
        </Card>
      )}

      {tab === "storage" && (
        <Card className="card-pad">
          <div className="between">
            <h2>Course media — GitHub Releases</h2>
            {isGithubConfigured(settings) ? (
              <Badge tone="positive">ready</Badge>
            ) : (
              <Badge tone="warning">token needed</Badge>
            )}
          </div>
          <p className="muted small">
            Videos, PDFs, images and banners are stored as assets on numbered releases in{" "}
            <strong>
              {settings.owner}/{settings.repo}
            </strong>
            . A full release (1,000 assets) rolls over to the next number automatically.
          </p>

          <form className="form-grid" onSubmit={saveStorage}>
            <Field
              label="GitHub token"
              hint="Fine-grained PAT with Contents: read & write. Stored in this browser only."
            >
              <Input
                type="password"
                autoComplete="off"
                value={gh.token}
                onChange={(e) => setGh({ ...gh, token: e.target.value })}
                placeholder="github_pat_…"
              />
            </Field>
            <div className="form-row">
              <Field label="Username / owner">
                <Input value={gh.owner} onChange={(e) => setGh({ ...gh, owner: e.target.value })} />
              </Field>
              <Field label="Repository">
                <Input value={gh.repo} onChange={(e) => setGh({ ...gh, repo: e.target.value })} />
              </Field>
            </div>
            <Field label="Upload service URL" hint="Files pass through this service, which talks to GitHub.">
              <Input value={gh.uploadUrl} onChange={(e) => setGh({ ...gh, uploadUrl: e.target.value })} />
            </Field>
            <div className="form-row">
              <Field label="Release tag prefix">
                <Input value={gh.prefix} onChange={(e) => setGh({ ...gh, prefix: e.target.value })} />
              </Field>
              <Field label="Assets per release" hint="GitHub's maximum is 1000.">
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={gh.maxAssets}
                  onChange={(e) => setGh({ ...gh, maxAssets: Number(e.target.value) })}
                />
              </Field>
            </div>
            <ErrorText>{ghError}</ErrorText>
            <div className="row wrap">
              <Button type="submit">Save storage settings</Button>
              <Button type="button" variant="secondary" onClick={testEverything} loading={ghBusy}>
                Test connection
              </Button>
            </div>
          </form>

          {service && <p className="small">{service}</p>}
          {ghStatus && (
            <p className="small">
              Connected as <strong>{ghStatus.login}</strong> → <strong>{ghStatus.repo}</strong>{" "}
              {ghStatus.canPush ? "with push access." : "without push access — uploads will fail."}
            </p>
          )}

          {stats && (
            <div className="storage-stats">
              <div>
                <span className="stat-label">Latest release</span>
                <strong>{stats.latestRelease || "none yet"}</strong>
              </div>
              <div>
                <span className="stat-label">Assets</span>
                <strong>
                  {stats.assetCount} / {stats.maxAssets}
                </strong>
              </div>
              <div className="storage-bar">
                <Progress value={(stats.assetCount / Math.max(1, stats.maxAssets)) * 100} />
                <span className="muted small">
                  {stats.maxAssets - stats.assetCount} slots left before the next release
                </span>
              </div>
            </div>
          )}

          {assets.length > 0 && (
            <div className="stack">
              <h3 className="small-heading">Recent uploads</h3>
              {assets.map((asset) => (
                <div className="list-row" key={asset.url}>
                  <div>
                    <strong className="small">{asset.name}</strong>
                    <p className="muted small">
                      {asset.releaseTag} · {(asset.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                  <a className="link small" href={asset.url} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
