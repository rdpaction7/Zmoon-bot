import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { clampPrice, listCategories, listCourses, saveCourse, submitCourse } from "../lib/api";
import type { Course, SkillCategory } from "../lib/types";
import { MediaUploader } from "../components/MediaUploader";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorText,
  Field,
  Input,
  Select,
  Skeleton,
  Textarea,
  useToast,
} from "../components/ui";

type Draft = {
  id?: string;
  title: string;
  description: string;
  category: string;
  level: Course["level"];
  thumbnailUrl: string;
  mediaUrl: string;
  mediaType: Course["mediaType"];
  price: number;
  status: Course["status"];
};

const EMPTY: Draft = {
  title: "",
  description: "",
  category: "Design",
  level: "beginner",
  thumbnailUrl: "",
  mediaUrl: "",
  mediaType: "none",
  price: 0,
  status: "draft",
};

export default function Studio() {
  const { user, isDemo } = useAuth();
  const { push } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    try {
      const [all, cats] = await Promise.all([listCourses(), listCategories().catch(() => [])]);
      setCourses(all.filter((course) => course.creatorId === user.id));
      setCategories(cats);
    } catch (caught: any) {
      setError(caught?.message || "Could not load your courses.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  function startNew() {
    setDraft({ ...EMPTY, category: categories[0]?.name || "Design" });
    setEditing(true);
    setError("");
  }

  function startEdit(course: Course) {
    setDraft({
      id: course.id,
      title: course.title,
      description: course.description,
      category: course.category,
      level: course.level,
      thumbnailUrl: course.thumbnailUrl,
      mediaUrl: course.mediaUrl,
      mediaType: course.mediaType,
      price: course.price,
      status: course.status,
    });
    setEditing(true);
    setError("");
  }

  async function save(submitForReview: boolean) {
    if (!user) return;
    setError("");
    if (draft.title.trim().length < 3) return setError("Add a course title.");
    if (draft.description.trim().length < 20) return setError("Describe the course in at least 20 characters.");
    setBusy(true);
    try {
      const id = await saveCourse(
        {
          creatorId: user.id,
          creatorName: user.displayName,
          title: draft.title.trim(),
          description: draft.description.trim(),
          category: draft.category,
          level: draft.level,
          thumbnailUrl: draft.thumbnailUrl,
          mediaUrl: draft.mediaUrl,
          mediaType: draft.mediaType,
          price: clampPrice(draft.price),
          status: draft.status,
        },
        draft.id,
      );
      if (submitForReview) await submitCourse(id);
      push(submitForReview ? "Course submitted for review." : "Draft saved.", "success");
      setEditing(false);
      await load();
    } catch (caught: any) {
      setError(caught?.message || "Could not save the course.");
    } finally {
      setBusy(false);
    }
  }

  if (isDemo) {
    return (
      <div className="page page-narrow">
        <Card className="card-pad">
          <h1>Creator tools are locked in demo mode</h1>
          <p className="muted">Create an account to publish courses and upload media.</p>
          <Link className="btn btn-primary" to="/signup">
            Create an account
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="section-head between">
        <div>
          <span className="eyebrow">Creator studio</span>
          <h1>Your courses</h1>
          <p className="muted">
            Courses go to review before they appear publicly. Creators earn 1 Skill Coin per 50 unique
            enrolments.
          </p>
        </div>
        <Button onClick={startNew}>New course</Button>
      </header>

      {editing && (
        <Card className="card-pad">
          <div className="between">
            <h2>{draft.id ? "Edit course" : "New course"}</h2>
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
              Close
            </Button>
          </div>
          <div className="form-grid">
            <Field label="Title">
              <Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
            </Field>
            <div className="form-row">
              <Field label="Category">
                <Select
                  value={draft.category}
                  onChange={(event) => setDraft({ ...draft, category: event.target.value })}
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
                <Select
                  value={draft.level}
                  onChange={(event) => setDraft({ ...draft, level: event.target.value as Course["level"] })}
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </Select>
              </Field>
              <Field label="Price (0–50 Skill Coins)" hint="0 makes the course free.">
                <Input
                  type="number"
                  min={0}
                  max={50}
                  value={draft.price}
                  onChange={(event) => setDraft({ ...draft, price: clampPrice(event.target.value) })}
                />
              </Field>
            </div>
            <Field label="Description">
              <Textarea
                rows={5}
                value={draft.description}
                onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              />
            </Field>

            <MediaUploader
              kind="thumbnail"
              label="Thumbnail or banner"
              value={draft.thumbnailUrl}
              onUploaded={(url) => setDraft({ ...draft, thumbnailUrl: url })}
            />

            <Field label="Main course material type">
              <Select
                value={draft.mediaType}
                onChange={(event) =>
                  setDraft({ ...draft, mediaType: event.target.value as Course["mediaType"] })
                }
              >
                <option value="none">No attachment</option>
                <option value="video">Video</option>
                <option value="pdf">PDF / document</option>
                <option value="image">Image</option>
                <option value="link">External link</option>
              </Select>
            </Field>

            <MediaUploader
              kind={draft.mediaType === "pdf" ? "pdf" : draft.mediaType === "video" ? "video" : "image"}
              label="Course material (video, PDF or image)"
              value={draft.mediaUrl}
              onUploaded={(url) => setDraft({ ...draft, mediaUrl: url })}
            />

            <ErrorText>{error}</ErrorText>
            <div className="row">
              <Button variant="secondary" onClick={() => save(false)} loading={busy}>
                Save draft
              </Button>
              <Button onClick={() => save(true)} loading={busy}>
                Save and submit for review
              </Button>
            </div>
          </div>
        </Card>
      )}

      {loading ? (
        <Skeleton lines={4} />
      ) : courses.length === 0 ? (
        <EmptyState
          title="No courses yet"
          body="Publish your first course and share what you know."
          action={<Button onClick={startNew}>New course</Button>}
        />
      ) : (
        <div className="grid grid-2">
          {courses.map((course) => (
            <Card className="card-pad" key={course.id}>
              <div className="pill-row">
                <Badge tone={course.status === "approved" ? "positive" : "warning"}>{course.status}</Badge>
                <Badge tone="accent">{course.price === 0 ? "Free" : `${course.price} coins`}</Badge>
                <Badge tone="neutral">{course.enrollmentCount || 0} enrolled</Badge>
              </div>
              <h2>{course.title}</h2>
              <p className="muted small clamp-3">{course.description}</p>
              <div className="row">
                <Button size="sm" variant="secondary" onClick={() => startEdit(course)}>
                  Edit
                </Button>
                {course.status !== "approved" && course.status !== "pending" && (
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        await submitCourse(course.id);
                        push("Submitted for review.", "success");
                        await load();
                      } catch (caught: any) {
                        push(caught?.message || "Could not submit.", "error");
                      }
                    }}
                  >
                    Submit for review
                  </Button>
                )}
                <Link className="btn btn-ghost btn-sm" to={`/courses/${course.id}`}>
                  Preview
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
