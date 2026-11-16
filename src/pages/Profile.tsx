import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { getProfileByUsername, listCourses, listSkills } from "../lib/api";
import type { Course, Skill, UserProfile as ProfileType } from "../lib/types";
import { firstName, slug, str, titleOf } from "../lib/text";
import { Avatar, Badge, Button, Card, EmptyState, Skeleton } from "../components/ui";

export default function Profile() {
  const { username = "" } = useParams();
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await getProfileByUsername(username);
        if (cancelled) return;
        if (!found) {
          setError("No member matches that username.");
          return;
        }
        setProfile(found);
        const [allSkills, allCourses] = await Promise.all([
          listSkills().catch(() => []),
          listCourses().catch(() => []),
        ]);
        if (cancelled) return;
        setSkills(allSkills.filter((skill) => skill.ownerId === found.id));
        setCourses(
          allCourses.filter(
            (course) => course.creatorId === found.id && (course.status === "approved" || found.id === user?.id),
          ),
        );
      } catch (caught: any) {
        if (!cancelled) setError(caught?.message || "Could not load this profile.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [username, user]);

  if (loading) {
    return (
      <div className="page">
        <Skeleton lines={6} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page page-narrow">
        <Card className="card-pad">
          <h1>Member not found</h1>
          <p className="muted">{error}</p>
          <Link className="btn btn-secondary" to="/skills">
            Browse members
          </Link>
        </Card>
      </div>
    );
  }

  const isMe = user?.id === profile.id;

  return (
    <div className="page">
      <Card className="card-pad profile-head">
        <Avatar name={str(profile.displayName, "Member")} src={profile.photoURL} size={84} />
        <div>
          <div className="pill-row">
            <h1>{str(profile.displayName, "Member")}</h1>
            {profile.role === "admin" && <Badge tone="accent">admin</Badge>}
            {profile.demo && <Badge tone="neutral">demo</Badge>}
          </div>
          <p className="muted">
            @{str(profile.username, "member")}
            {profile.location ? ` · ${profile.location}` : ""}
          </p>
          {profile.bio && <p>{profile.bio}</p>}
          <div className="row">
            <Badge tone="positive">{profile.balance} Skill Coins</Badge>
            {isMe && (
              <Link className="btn btn-secondary btn-sm" to="/settings">
                Edit profile
              </Link>
            )}
            {!isMe && user && (
              <Link className="btn btn-primary btn-sm" to="/messages">
                Message
              </Link>
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-2">
        <Card className="card-pad">
          <h2>Skills offered</h2>
          {skills.length === 0 ? (
            <p className="muted small">No skills listed yet.</p>
          ) : (
            <div className="stack">
              {skills.map((skill) => (
                <div className="list-row" key={skill.id}>
                  <div>
                    <strong>{skill.title}</strong>
                    <p className="muted small clamp-3">{skill.description}</p>
                  </div>
                  <Badge tone={skill.status === "approved" ? "positive" : "warning"}>{skill.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="card-pad">
          <h2>Learning goals</h2>
          <div className="pill-row">
            {(profile.interests || []).map((interest) => (
              <Badge key={`i-${interest}`}>{interest}</Badge>
            ))}
            {(profile.skillsWanted || []).map((skill) => (
              <Badge key={`s-${skill}`} tone="accent">
                wants {skill}
              </Badge>
            ))}
          </div>
          {profile.goals && <p className="muted small">{profile.goals}</p>}
          {!profile.goals && (profile.interests || []).length === 0 && (profile.skillsWanted || []).length === 0 && (
            <p className="muted small">Nothing added yet.</p>
          )}
        </Card>
      </div>

      <section className="section">
        <h2>Courses by {firstName(profile.displayName, "this member")}</h2>
        {courses.length === 0 ? (
          <EmptyState title="No published courses" body="This member has not published a course yet." />
        ) : (
          <div className="grid grid-3">
            {courses.map((course) => (
              <Link className="course-card card" key={course.id} to={`/courses/${course.id}`}>
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
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {isMe && (
        <div className="row">
          <Button variant="secondary" onClick={() => window.location.assign("/studio")}>
            Creator studio
          </Button>
          <Button variant="ghost" onClick={() => window.location.assign("/library")}>
            My library
          </Button>
        </div>
      )}
    </div>
  );
}
