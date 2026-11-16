import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { getCourse, listEnrollments } from "../lib/api";
import type { Course, Enrollment } from "../lib/types";
import { Badge, Card, EmptyState, Skeleton } from "../components/ui";

export default function Library() {
  const { user } = useAuth();
  const [items, setItems] = useState<{ enrollment: Enrollment; course: Course | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const enrollments = await listEnrollments(user.id);
        const withCourses = await Promise.all(
          enrollments.map(async (enrollment) => ({
            enrollment,
            course: await getCourse(enrollment.courseId).catch(() => null),
          })),
        );
        setItems(withCourses);
      } catch (caught: any) {
        setError(caught?.message || "Could not load your library.");
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  return (
    <div className="page">
      <header className="section-head">
        <span className="eyebrow">Learner library</span>
        <h1>Your courses</h1>
        <p className="muted">Everything you have enrolled in, in one place.</p>
      </header>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <Skeleton lines={5} />
      ) : items.length === 0 ? (
        <EmptyState
          title="Your library is empty"
          body="Enrol in a free course, or spend a few Skill Coins on a paid one."
          action={
            <Link className="btn btn-primary" to="/courses">
              Browse courses
            </Link>
          }
        />
      ) : (
        <div className="grid grid-2">
          {items.map(({ enrollment, course }) => (
            <Card className="card-pad" key={enrollment.id}>
              <div className="pill-row">
                <Badge tone="positive">Enrolled</Badge>
                <Badge tone="accent">{enrollment.pricePaid === 0 ? "Free" : `${enrollment.pricePaid} coins`}</Badge>
              </div>
              <h2>{course ? course.title : "Course no longer available"}</h2>
              {course && <p className="muted small">by {course.creatorName}</p>}
              {course && <p className="muted small clamp-3">{course.description}</p>}
              {course && (
                <div className="row">
                  <Link className="btn btn-secondary btn-sm" to={`/courses/${course.id}`}>
                    Open course
                  </Link>
                  {course.mediaUrl && (
                    <a
                      className="btn btn-ghost btn-sm"
                      href={course.mediaUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Course material
                    </a>
                  )}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
