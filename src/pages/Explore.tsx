import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createReport,
  createSkill,
  createSwap,
  deleteSkill,
  listCategories,
  listSkills,
  listAllUsers,
} from "../lib/api";
import type { Skill, SkillCategory, UserProfile } from "../lib/types";
import { slug, str, titleOf } from "../lib/text";
import { useAuth } from "../state/AuthContext";
import {
  Avatar,
  Badge,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorText,
  Field,
  Input,
  Modal,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from "../components/ui";

export default function Explore() {
  const { user, isDemo } = useAuth();
  const { push } = useToast();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [members, setMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState("all");
  const [sort, setSort] = useState("newest");

  const [addOpen, setAddOpen] = useState(false);
  const [active, setActive] = useState<Skill | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Skill | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const [form, setForm] = useState({ title: "", category: "Design", level: "beginner", description: "" });
  const [swapForm, setSwapForm] = useState({ offeredSkill: "", wantedSkill: "", message: "" });
  const [reportReason, setReportReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  async function load() {
    setLoading(true);
    setLoadError("");
    try {
      const [allSkills, allCategories, allUsers] = await Promise.all([
        listSkills(),
        listCategories(),
        listAllUsers().catch(() => [] as UserProfile[]),
      ]);
      setSkills(allSkills);
      setCategories(allCategories);
      setMembers(allUsers);
    } catch (error: any) {
      setLoadError(error?.message || "Could not load skills. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const visible = useMemo(() => {
    const query = term.trim().toLowerCase();
    let list = skills.filter((skill) => {
      const isOwner = user && skill.ownerId === user.id;
      if (skill.status !== "approved" && !isOwner && user?.role !== "admin") return false;
      if (category !== "all" && skill.category !== category) return false;
      if (level !== "all" && skill.level !== level) return false;
      if (!query) return true;
      return [skill.title, skill.description, skill.category, skill.ownerName]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
    if (sort === "az") list = [...list].sort((a, b) => a.title.localeCompare(b.title));
    else list = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return list;
  }, [skills, term, category, level, sort, user]);

  async function addSkill(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!user) return;
    if (form.title.trim().length < 3) return setFormError("Give your skill a clear title (3+ characters).");
    if (form.description.trim().length < 20)
      return setFormError("Describe your skill in at least 20 characters so people know what they get.");
    setBusy(true);
    try {
      await createSkill({
        owner: user,
        title: form.title.trim(),
        category: form.category,
        level: form.level as Skill["level"],
        description: form.description.trim(),
      });
      setAddOpen(false);
      setForm({ title: "", category: "Design", level: "beginner", description: "" });
      push("Skill submitted for review.", "success");
      await load();
    } catch (error: any) {
      setFormError(error?.message || "Could not save your skill.");
    } finally {
      setBusy(false);
    }
  }

  async function requestSwap(event: React.FormEvent) {
    event.preventDefault();
    setFormError("");
    if (!user || !active) return;
    const owner = members.find((member) => member.id === active.ownerId);
    if (!owner) return setFormError("This member's profile could not be loaded.");
    if (owner.id === user.id) return setFormError("This is your own skill.");
    setBusy(true);
    try {
      await createSwap({
        from: user,
        to: owner,
        offeredSkill: swapForm.offeredSkill.trim() || "A skill I can teach",
        wantedSkill: swapForm.wantedSkill.trim() || active.title,
        message: swapForm.message.trim(),
      });
      push("Swap request sent.", "success");
      setActive(null);
      setSwapForm({ offeredSkill: "", wantedSkill: "", message: "" });
    } catch (error: any) {
      setFormError(error?.message || "Could not send the request.");
    } finally {
      setBusy(false);
    }
  }

  async function removeSkill(skill: Skill) {
    try {
      await deleteSkill(skill.id);
      push("Skill removed.", "success");
      setPendingDelete(null);
      setActive(null);
      await load();
    } catch (error: any) {
      push(error?.message || "Could not remove the skill.", "error");
    }
  }

  async function submitReport() {
    if (!user || !active) return;
    if (reportReason.trim().length < 5) return push("Add a short reason for the report.", "error");
    try {
      await createReport({
        reporter: user,
        targetType: "skill",
        targetId: active.id,
        reason: reportReason.trim(),
      });
      setReportOpen(false);
      setReportReason("");
      push("Report sent to the moderators.", "success");
    } catch (error: any) {
      push(error?.message || "Could not send the report.", "error");
    }
  }

  return (
    <div className="page">
      <header className="section-head between">
        <div>
          <span className="eyebrow">Discover</span>
          <h1>Skills worth swapping</h1>
          <p className="muted">
            Find someone who knows what you want to learn — and offer what you already do well.
          </p>
        </div>
        {user && !isDemo && (
          <Button onClick={() => setAddOpen(true)}>Offer a skill</Button>
        )}
      </header>

      <div className="filter-bar">
        <Input
          placeholder="Search skills, categories or members"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          aria-label="Search skills"
        />
        <Select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Category">
          <option value="all">All categories</option>
          {categories.map((entry) => (
            <option key={entry.id} value={entry.name}>
              {entry.name}
            </option>
          ))}
        </Select>
        <Select value={level} onChange={(event) => setLevel(event.target.value)} aria-label="Level">
          <option value="all">Any level</option>
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </Select>
        <Select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort">
          <option value="newest">Newest first</option>
          <option value="az">A → Z</option>
        </Select>
      </div>

      <ErrorText>{loadError}</ErrorText>

      {loading ? (
        <Skeleton lines={6} />
      ) : visible.length === 0 ? (
        <EmptyState
          title="No skills match yet"
          body={
            skills.length === 0
              ? "Nothing has been published here yet. Be the first to offer a skill."
              : "Try a broader search or clear the filters."
          }
          action={
            user && !isDemo ? (
              <Button variant="secondary" onClick={() => setAddOpen(true)}>
                Offer a skill
              </Button>
            ) : (
              <Link className="btn btn-secondary" to="/signup">
                Join to offer a skill
              </Link>
            )
          }
        />
      ) : (
        <div className="grid grid-3">
          {visible.map((skill) => (
            <article className="skill-card card" key={skill.id}>
              <div className="pill-row">
                <Badge>{skill.category}</Badge>
                <Badge tone="neutral">{skill.level}</Badge>
                {skill.status !== "approved" && <Badge tone="warning">{skill.status}</Badge>}
              </div>
              <h3>{titleOf(skill.title, "Untitled skill")}</h3>
              <p className="muted small clamp-3">{skill.description}</p>
              <div className="between creator-row">
                <span className="row small">
                  <Avatar name={str(skill.ownerName, "Member")} size={26} />
                  {str(skill.ownerName, "Member")}
                </span>
                <Button size="sm" variant="secondary" onClick={() => setActive(skill)}>
                  View
                </Button>
              </div>
              {user && skill.ownerId === user.id && (
                <Button size="sm" variant="ghost" onClick={() => setPendingDelete(skill)}>
                  Remove my skill
                </Button>
              )}
            </article>
          ))}
        </div>
      )}

      <Modal
        open={addOpen}
        title="Offer a skill"
        onClose={() => setAddOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button onClick={addSkill} loading={busy}>
              Submit for review
            </Button>
          </>
        }
      >
        <form className="form-grid" onSubmit={addSkill}>
          <Field label="Skill title">
            <Input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
          </Field>
          <Field label="Category">
            <Select
              value={form.category}
              onChange={(event) => setForm({ ...form, category: event.target.value })}
            >
              {categories.length === 0 && <option value="Design">Design</option>}
              {categories.map((entry) => (
                <option key={entry.id} value={entry.name}>
                  {entry.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Level">
            <Select value={form.level} onChange={(event) => setForm({ ...form, level: event.target.value })}>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </Select>
          </Field>
          <Field label="What will you teach?">
            <Textarea
              rows={4}
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
            />
          </Field>
          <ErrorText>{formError}</ErrorText>
        </form>
      </Modal>

      <Modal
        open={Boolean(active)}
        title={titleOf(active?.title, "Skill")}
        onClose={() => setActive(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReportOpen(true)}>
              Report
            </Button>
            <Button onClick={requestSwap} loading={busy} disabled={isDemo}>
              Send swap request
            </Button>
          </>
        }
      >
        {active && (
          <div className="form-grid">
            <div className="pill-row">
              <Badge>{active.category}</Badge>
              <Badge tone="neutral">{active.level}</Badge>
            </div>
            <p>{active.description}</p>
            <Link className="link" to={`/u/${slug(active.ownerName)}`}>
              View {str(active.ownerName, "this member")}'s profile →
            </Link>
            {isDemo ? (
              <p className="muted small">Demo accounts cannot send swap requests.</p>
            ) : (
              <>
                <Field label="What you will offer">
                  <Input
                    value={swapForm.offeredSkill}
                    onChange={(event) => setSwapForm({ ...swapForm, offeredSkill: event.target.value })}
                    placeholder="e.g. Beginner guitar"
                  />
                </Field>
                <Field label="What you want to learn">
                  <Input
                    value={swapForm.wantedSkill}
                    onChange={(event) => setSwapForm({ ...swapForm, wantedSkill: event.target.value })}
                    placeholder={active.title}
                  />
                </Field>
                <Field label="Note">
                  <Textarea
                    rows={3}
                    value={swapForm.message}
                    onChange={(event) => setSwapForm({ ...swapForm, message: event.target.value })}
                    placeholder="Introduce yourself and suggest a time."
                  />
                </Field>
                <ErrorText>{formError}</ErrorText>
              </>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={reportOpen}
        title="Report this skill"
        onClose={() => setReportOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={submitReport}>
              Send report
            </Button>
          </>
        }
      >
        <Field label="What is wrong?">
          <Textarea
            rows={4}
            value={reportReason}
            onChange={(event) => setReportReason(event.target.value)}
            placeholder="Spam, misleading, copied content…"
          />
        </Field>
      </Modal>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Remove this skill?"
        body={`"${pendingDelete?.title || ""}" will be removed from your profile and from discovery. This cannot be undone.`}
        confirmLabel="Remove"
        tone="danger"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => pendingDelete && removeSkill(pendingDelete)}
      />
    </div>
  );
}
