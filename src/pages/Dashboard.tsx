import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import {
  getStreak,
  listCourses,
  listEnrollments,
  listNotifications,
  listSkills,
  listSwaps,
} from "../lib/api";
import type { AppNotification, Course, Enrollment, Skill, Streak, SwapRequest } from "../lib/types";
import { firstName, slug, titleOf } from "../lib/text";
import { Badge, Button, Card, Skeleton, Stat } from "../components/ui";

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [skills, setSkills] = useState<Skill[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [streak, setStreak] = useState<Streak | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const [allSkills, allCourses, myEnrollments, mySwaps, myStreak, notes] = await Promise.all([
          listSkills(),
          listCourses(),
          listEnrollments(user.id),
          listSwaps(user.id),
          getStreak(user.id).catch(() => null),
          listNotifications(user.id).catch(() => []),
        ]);
        if (cancelled) return;
        setSkills(allSkills.filter((skill) => skill.ownerId === user.id));
        setCourses(allCourses);
        setEnrollments(myEnrollments);
        setSwaps(mySwaps);
        setStreak(myStreak);
        setNotifications(notes.filter((note) => !note.read).slice(0, 4));
      } catch (caught: any) {
        if (!cancelled) setError(caught?.message || "Could not load your dashboard.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  if (!user) return null;

  const pendingSwaps = swaps.filter((swap) => swap.status === "pending").length;
  const enrolledIds = new Set(enrollments.map((entry) => entry.courseId));
  const recommended = courses
    .filter((course) => course.status === "approved" && !enrolledIds.has(course.id))
    .slice(0, 3);

  return (
    <div className="page">
      <header className="section-head between">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h1>Hello, {firstName(user.displayName)}</h1>
          <p className="muted">
            {user.demo
              ? "You are browsing as a demo visitor."
              : "Here is where your teaching and learning stand today."}
          </p>
        </div>
        <div className="row">
          <Link className="btn btn-secondary btn-sm" to="/wallet">
            {user.balance} Skill Coins
          </Link>
          {isAdmin && (
            <Link className="btn btn-primary btn-sm" to="/admin">
              Admin console
            </Link>
          )}
        </div>
      </header>

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <Skeleton lines={6} />
      ) : (
        <>
          <div className="grid grid-4">
            <Card className="card-pad">
              <Stat label="Skill Coins" value={user.balance} hint="Used only for paid courses" />
            </Card>
            <Card className="card-pad">
              <Stat
                label="Daily streak"
                value={streak ? `${streak.current} day${streak.current === 1 ? "" : "s"}` : "—"}
                hint={streak?.lastClaimDay === new Date().toISOString().slice(0, 10) ? "Claimed today" : "Not claimed today"}
              />
            </Card>
            <Card className="card-pad">
              <Stat label="Courses enrolled" value={enrollments.length} hint="In your library" />
            </Card>
            <Card className="card-pad">
              <Stat label="Pending swaps" value={pendingSwaps} hint="Waiting on a reply" />
            </Card>
          </div>

          <div className="grid grid-2">
            <Card className="card-pad">
              <div className="between">
                <h2>Your skills</h2>
                <Link className="link small" to="/skills">
                  Discover more →
                </Link>
              </div>
              {skills.length === 0 ? (
                <p className="muted small">
                  You have not listed a skill yet.{" "}
                  <Link className="link" to="/skills">
                    Offer one
                  </Link>{" "}
                  so people can find you.
                </p>
              ) : (
                <ul className="list">
                  {skills.map((skill) => (
                    <li key={skill.id} className="list-row">
                      <span>{skill.title}</span>
                      <Badge tone={skill.status === "approved" ? "positive" : "warning"}>
                        {skill.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="card-pad">
              <div className="between">
                <h2>Activity</h2>
                <Link className="link small" to="/notifications">
                  All notifications →
                </Link>
              </div>
              {notifications.length === 0 ? (
                <p className="muted small">Nothing new right now.</p>
              ) : (
                <ul className="list">
                  {notifications.map((note) => (
                    <li key={note.id} className="list-row">
                      <div>
                        <strong className="small">{note.title}</strong>
                        <p className="muted small">{note.body}</p>
                      </div>
                      <Badge tone="accent">{note.type}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <section className="section">
            <div className="between">
              <h2>Recommended for you</h2>
              <Link className="link small" to="/courses">
                Browse all →
              </Link>
            </div>
            {recommended.length === 0 ? (
              <p className="muted small">No new approved courses yet.</p>
            ) : (
              <div className="grid grid-3">
                {recommended.map((course) => (
                  <Link key={course.id} className="course-card card" to={`/courses/${course.id}`}>
                    <div className="thumb">
                      {course.thumbnailUrl ? (
                        <img src={course.thumbnailUrl} alt="" />
                      ) : (
                        <span className="thumb-fallback">{slug(course.title).slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="course-body">
                      <div className="pill-row">
                        <Badge>{course.category}</Badge>
                        <Badge tone="accent">{course.price === 0 ? "Free" : `${course.price} coins`}</Badge>
                      </div>
                      <h3>{titleOf(course.title)}</h3>
                      <p className="muted small">by {course.creatorName}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </section>

          <Card className="card-pad">
            <div className="between">
              <div>
                <h2>Teach something</h2>
                <p className="muted small">Publish a course, or start with a one-to-one swap.</p>
              </div>
              <div className="row">
                <Link className="btn btn-secondary btn-sm" to="/swaps">
                  Swap requests
                </Link>
                <Link className="btn btn-primary btn-sm" to="/studio">
                  Creator studio
                </Link>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
