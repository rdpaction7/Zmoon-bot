import { useEffect, useRef, useState } from "react";
import { useAuth } from "../state/AuthContext";
import {
  addCategory,
  listAllTransactions,
  listAllUsers,
  listAuditLogs,
  listCategories,
  listCourses,
  listReports,
  listSkills,
  removeCategory,
  runAdminCommand,
  setCourseStatus,
  setReportStatus,
  setSkillStatus,
  setUserStatus,
} from "../lib/api";
import type {
  AuditLog,
  CoinTransaction,
  Course,
  Report,
  Skill,
  SkillCategory,
  UserProfile,
} from "../lib/types";
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  Field,
  Input,
  Select,
  Skeleton,
  Tabs,
  useToast,
} from "../components/ui";

const TABS = [
  { id: "users", label: "Users" },
  { id: "skills", label: "Skills" },
  { id: "courses", label: "Courses" },
  { id: "reports", label: "Reports" },
  { id: "ledger", label: "Coin ledger" },
  { id: "audit", label: "Audit log" },
  { id: "console", label: "Command console" },
];

export default function Admin() {
  const { user } = useAuth();
  const { push } = useToast();
  const [tab, setTab] = useState("users");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [ledger, setLedger] = useState<CoinTransaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [search, setSearch] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    body: string;
    run: () => Promise<void>;
  } | null>(null);

  const [lines, setLines] = useState<string[]>([
    "SkillSwap admin console. Type /help for commands.",
  ]);
  const [command, setCommand] = useState("");
  const [consoleBusy, setConsoleBusy] = useState(false);
  const consoleEnd = useRef<HTMLDivElement | null>(null);

  async function loadAll() {
    setLoading(true);
    try {
      const [allUsers, allSkills, allCourses, allReports, allLedger, logs, cats] = await Promise.all([
        listAllUsers(),
        listSkills(),
        listCourses(),
        listReports().catch(() => []),
        listAllTransactions().catch(() => []),
        listAuditLogs().catch(() => []),
        listCategories().catch(() => []),
      ]);
      setUsers(allUsers);
      setSkills(allSkills);
      setCourses(allCourses);
      setReports(allReports);
      setLedger(allLedger);
      setAuditLogs(logs);
      setCategories(cats);
      setError("");
    } catch (caught: any) {
      setError(caught?.message || "Could not load admin data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    consoleEnd.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  async function submitCommand(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !command.trim()) return;
    const raw = command.trim();
    setLines((current) => [...current, `> ${raw}`]);
    setCommand("");
    setConsoleBusy(true);
    try {
      const result = await runAdminCommand(user, raw);
      setLines((current) => [...current, ...(result.ok ? result.output : result.output)]);
      if (result.ok) await loadAll();
    } catch (caught: any) {
      setLines((current) => [...current, `Error: ${caught?.message || "command failed"}`]);
    } finally {
      setConsoleBusy(false);
    }
  }

  const filteredUsers = users.filter((entry) => {
    if (!search.trim()) return true;
    const needle = search.toLowerCase();
    return `${entry.displayName} ${entry.username} ${entry.email} ${entry.id}`.toLowerCase().includes(needle);
  });

  return (
    <div className="page">
      <header className="section-head between">
        <div>
          <span className="eyebrow">Administration</span>
          <h1>Admin console</h1>
          <p className="muted">
            Signed in as {user?.email}. Admin actions are recorded in the audit log.
          </p>
        </div>
        <Badge tone="positive">Active</Badge>
      </header>

      {error && <p className="error-text">{error}</p>}

      <Tabs tabs={TABS} value={tab} onChange={setTab} />

      <ConfirmDialog
        open={Boolean(confirmAction)}
        title={confirmAction?.title || "Confirm"}
        body={confirmAction?.body || ""}
        confirmLabel="Confirm"
        tone="danger"
        onCancel={() => setConfirmAction(null)}
        onConfirm={async () => {
          const action = confirmAction;
          setConfirmAction(null);
          if (!action) return;
          try {
            await action.run();
          } catch (caught: any) {
            push(caught?.message || "Action failed.", "error");
          }
        }}
      />

      {loading ? (
        <Skeleton lines={6} />
      ) : (
        <>
          {tab === "users" && (
            <Card className="card-pad">
              <div className="between">
                <h2>Users ({users.length})</h2>
                <Input
                  placeholder="Search name, email or id"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  aria-label="Search users"
                />
              </div>
              <div className="table">
                <div className="table-row table-head">
                  <span>Member</span>
                  <span>Role</span>
                  <span>Coins</span>
                  <span>Status</span>
                  <span />
                </div>
                {filteredUsers.slice(0, 100).map((entry) => (
                  <div className="table-row" key={entry.id}>
                    <span>
                      <strong>{entry.displayName}</strong>
                      <br />
                      <span className="muted small">
                        @{entry.username} · {entry.email}
                      </span>
                    </span>
                    <span>{entry.role}</span>
                    <span>{entry.balance}</span>
                    <span>
                      <Badge tone={entry.status === "active" ? "positive" : "danger"}>{entry.status}</Badge>
                    </span>
                    <span>
                      <Button
                        size="sm"
                        variant={entry.status === "active" ? "danger" : "secondary"}
                        onClick={() => {
                          const nextStatus = entry.status === "active" ? "suspended" : "active";
                          setConfirmAction({
                            title: nextStatus === "suspended" ? "Suspend this member?" : "Restore this member?",
                            body:
                              nextStatus === "suspended"
                                ? `${entry.displayName} (@${entry.username}) will be signed out and blocked from the app until restored.`
                                : `${entry.displayName} (@${entry.username}) will be able to sign in and use SkillSwap again.`,
                            run: async () => {
                              await setUserStatus(entry.id, nextStatus as UserProfile["status"]);
                              push(`${entry.displayName} is now ${nextStatus}.`, "success");
                              await loadAll();
                            },
                          });
                        }}
                      >
                        {entry.status === "active" ? "Suspend" : "Restore"}
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === "skills" && (
            <div className="grid grid-2">
              <Card className="card-pad">
                <h2>Skill review</h2>
                {skills.length === 0 && <p className="muted small">No skills submitted yet.</p>}
                <div className="stack">
                  {skills.map((skill) => (
                    <div className="list-row" key={skill.id}>
                      <div>
                        <strong className="small">{skill.title}</strong>
                        <p className="muted small">
                          {skill.ownerName} · {skill.category} · {skill.status}
                        </p>
                      </div>
                      <div className="row">
                        <Button
                          size="sm"
                          onClick={async () => {
                            await setSkillStatus(skill.id, "approved");
                            push("Skill approved.", "success");
                            await loadAll();
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            await setSkillStatus(skill.id, "rejected");
                            push("Skill rejected.", "success");
                            await loadAll();
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="card-pad">
                <h2>Categories</h2>
                <form
                  className="form-row"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const input = (event.currentTarget.elements.namedItem("category") as HTMLInputElement).value.trim();
                    if (!input) return;
                    try {
                      await addCategory(input);
                      push("Category added.", "success");
                      await loadAll();
                      (event.target as HTMLFormElement).reset();
                    } catch (caught: any) {
                      push(caught?.message || "Could not add category.", "error");
                    }
                  }}
                >
                  <Field label="New category">
                    <Input name="category" placeholder="e.g. Music" />
                  </Field>
                  <Button type="submit" size="sm">
                    Add
                  </Button>
                </form>
                <div className="stack">
                  {categories.map((entry) => (
                    <div className="list-row" key={entry.id}>
                      <span>{entry.name}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setConfirmAction({
                            title: "Remove this category?",
                            body: `"${entry.name}" will disappear from the category picker. Existing skills keep their label.`,
                            run: async () => {
                              await removeCategory(entry.id);
                              push("Category removed.", "success");
                              await loadAll();
                            },
                          })
                        }
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {tab === "courses" && (
            <Card className="card-pad">
              <h2>Course moderation</h2>
              <div className="stack">
                {courses.map((course) => (
                  <div className="list-row" key={course.id}>
                    <div>
                      <strong className="small">{course.title}</strong>
                      <p className="muted small">
                        {course.creatorName} · {course.price === 0 ? "Free" : `${course.price} coins`} ·{" "}
                        {course.status}
                      </p>
                    </div>
                    <div className="row">
                      <Select
                        value={course.status}
                        onChange={async (event) => {
                          try {
                            await setCourseStatus(course.id, event.target.value as Course["status"]);
                            push("Course updated.", "success");
                            await loadAll();
                          } catch (caught: any) {
                            push(caught?.message || "Action failed.", "error");
                          }
                        }}
                        aria-label={`Status for ${course.title}`}
                      >
                        <option value="draft">draft</option>
                        <option value="pending">pending</option>
                        <option value="approved">approved</option>
                        <option value="rejected">rejected</option>
                        <option value="suspended">suspended</option>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === "reports" && (
            <Card className="card-pad">
              <h2>Moderation queue</h2>
              {reports.length === 0 ? (
                <p className="muted small">No reports open.</p>
              ) : (
                <div className="stack">
                  {reports.map((report) => (
                    <div className="list-row" key={report.id}>
                      <div>
                        <strong className="small">
                          {report.targetType}: {report.targetId}
                        </strong>
                        <p className="muted small">{report.reason}</p>
                        <p className="muted small">
                          by {report.reporterName} · {new Date(report.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <div className="row">
                        <Badge tone={report.status === "open" ? "warning" : "positive"}>{report.status}</Badge>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={async () => {
                            await setReportStatus(report.id, "resolved");
                            await loadAll();
                          }}
                        >
                          Resolve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={async () => {
                            await setReportStatus(report.id, "dismissed");
                            await loadAll();
                          }}
                        >
                          Dismiss
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === "ledger" && (
            <Card className="card-pad">
              <h2>Coin ledger</h2>
              <div className="stack">
                {ledger.map((entry) => {
                  const member = users.find((candidate) => candidate.id === entry.userId);
                  return (
                    <div className="list-row" key={entry.id}>
                      <div>
                        <strong className="small">{entry.reason}</strong>
                        <p className="muted small">
                          {member ? `@${member.username}` : entry.userId} ·{" "}
                          {new Date(entry.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge tone={entry.amount >= 0 ? "positive" : "danger"}>
                        {entry.amount >= 0 ? "+" : ""}
                        {entry.amount}
                      </Badge>
                    </div>
                  );
                })}
                {ledger.length === 0 && <p className="muted small">No transactions yet.</p>}
              </div>
            </Card>
          )}

          {tab === "audit" && (
            <Card className="card-pad">
              <h2>Audit log</h2>
              <div className="stack">
                {auditLogs.map((entry) => (
                  <div className="list-row" key={entry.id}>
                    <div>
                      <strong className="small">{entry.action}</strong>
                      <p className="muted small">{entry.detail}</p>
                      <p className="muted small">
                        {entry.adminEmail} · {new Date(entry.createdAt).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
                {auditLogs.length === 0 && <p className="muted small">No admin actions recorded yet.</p>}
              </div>
            </Card>
          )}

          {tab === "console" && (
            <Card className="card-pad">
              <h2>Command console</h2>
              <p className="muted small">
                /List · /Givem #user #amount · /Takem #user #amount · /Givem #me #amount · /Takem #me #amount
              </p>
              <div className="console-out" role="log" aria-live="polite">
                {lines.map((line, index) => (
                  <div className="console-line" key={index}>
                    {line}
                  </div>
                ))}
                <div ref={consoleEnd} />
              </div>
              <form className="console-input" onSubmit={submitCommand}>
                <Input
                  value={command}
                  onChange={(event) => setCommand(event.target.value)}
                  placeholder="/Givem #me 5"
                  aria-label="Admin command"
                  disabled={consoleBusy}
                />
                <Button type="submit" loading={consoleBusy}>
                  Run
                </Button>
              </form>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
