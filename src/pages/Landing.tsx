import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listAllUsers, listCourses, listSkills } from "../lib/api";
import type { Course } from "../lib/types";
import { Badge } from "../components/ui";

const PRINCIPLES = [
  {
    mark: "01",
    title: "Swapping stays free",
    body: "No fees, no credits, no paywall on a conversation. Coins exist only to price paid courses.",
  },
  {
    mark: "02",
    title: "Your work is yours",
    body: "Courses, files and reviews belong to the member who made them. Reports and moderation are human-reviewed.",
  },
  {
    mark: "03",
    title: "Honest by default",
    body: "No fake progress numbers, no fake testimonials, no invented success messages. If something fails, we say so.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Build your profile",
    body: "List the skills you can teach and the ones you want to learn. Add a goal so people know what you are after.",
  },
  {
    n: "02",
    title: "Find your match",
    body: "Search by skill, category or member, then send a swap request with a short note.",
  },
  {
    n: "03",
    title: "Teach and learn",
    body: "Message, meet, and mark the swap complete. Leave a review when you finish a course.",
  },
];

export default function Landing() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState({ members: 0, skills: 0, courses: 0 });

  useEffect(() => {
    (async () => {
      const [allCourses, allSkills, allUsers] = await Promise.all([
        listCourses().catch(() => []),
        listSkills().catch(() => []),
        listAllUsers().catch(() => []),
      ]);
      const approved = allCourses.filter((course) => course.status === "approved");
      setCourses(approved.slice(0, 3));
      setStats({
        members: allUsers.length,
        skills: allSkills.filter((skill) => skill.status === "approved").length,
        courses: approved.length,
      });
    })();
  }, []);

  return (
    <div className="landing">
      <section className="hero">
        <div className="hero-copy reveal">
          <span className="eyebrow">A learning community, not a marketplace</span>
          <h1 className="display">
            Teach what you know.
            <br />
            Learn what you <em>don't</em>.
          </h1>
          <p className="lede">
            SkillSwap is a warm, quiet place to exchange skills with real people. Swap one-to-one for
            free, or publish a course and let learners come to you.
          </p>
          <div className="hero-actions">
            <Link className="btn btn-primary btn-md" to="/signup">
              Join SkillSwap
            </Link>
            <Link className="btn btn-secondary btn-md" to="/skills">
              Explore skills
            </Link>
            <Link className="btn btn-ghost btn-md" to="/courses">
              Browse courses
            </Link>
          </div>
          <p className="muted small">
            Free to join · no email verification hoops · swaps and messages never cost coins
          </p>
        </div>

        <div className="hero-art reveal reveal-2" aria-hidden="true">
          <div className="stack-cards">
            <div className="stack-card">
              <span className="badge badge-accent">Swap request</span>
              <strong>Design systems ↔ Spanish</strong>
              <span className="muted small">Maya teaches Figma, you teach conversation.</span>
            </div>
            <div className="stack-card stack-card-alt">
              <span className="badge badge-positive">Course published</span>
              <strong>Watercolour for beginners</strong>
              <span className="muted small">12 lessons · 8 coins</span>
            </div>
            <div className="stack-card stack-card-faint">
              <span className="badge">Daily streak</span>
              <strong>Day 11</strong>
              <span className="muted small">+1 Skill Coin</span>
            </div>
          </div>
        </div>
      </section>

      <section className="stat-band reveal reveal-2" aria-label="Community at a glance">
        <div className="stat-band-item">
          <span className="stat-band-value">{stats.members}</span>
          <span className="stat-band-label">Members</span>
        </div>
        <div className="stat-band-item">
          <span className="stat-band-value">{stats.skills}</span>
          <span className="stat-band-label">Skills offered</span>
        </div>
        <div className="stat-band-item">
          <span className="stat-band-value">{stats.courses}</span>
          <span className="stat-band-label">Courses published</span>
        </div>
        <div className="stat-band-item">
          <span className="stat-band-value">0</span>
          <span className="stat-band-label">Fees on swaps</span>
        </div>
      </section>

      <section className="section section-sand">
        <div className="section-head">
          <h2>How swapping works</h2>
          <p className="muted">Three steps, no payment, no middleman.</p>
        </div>
        <div className="how-grid">
          {STEPS.map((step) => (
            <div className="step" key={step.n}>
              <span className="step-n">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {courses.length > 0 && (
        <section className="section">
          <div className="section-head between">
            <div>
              <h2>Fresh from creators</h2>
              <p className="muted">Newly approved courses, newest first.</p>
            </div>
            <Link to="/courses" className="link">
              See all courses →
            </Link>
          </div>
          <div className="grid grid-3">
            {courses.map((course) => (
              <Link key={course.id} to={`/courses/${course.id}`} className="course-card card">
                <div className="thumb">
                  {course.thumbnailUrl ? (
                    <img src={course.thumbnailUrl} alt="" loading="lazy" />
                  ) : (
                    <span className="thumb-fallback">{course.title.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <div className="course-body">
                  <div className="pill-row">
                    <Badge>{course.category}</Badge>
                    <Badge tone="accent">{course.price === 0 ? "Free" : `${course.price} coins`}</Badge>
                  </div>
                  <h3>{course.title}</h3>
                  <p className="muted small">by {course.creatorName}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <h2>What we promise</h2>
          <p className="muted">Small commitments that keep the place trustworthy.</p>
        </div>
        <div className="feature-grid">
          {PRINCIPLES.map((principle) => (
            <article className="principle" key={principle.mark}>
              <span className="principle-mark" aria-hidden="true">
                {principle.mark}
              </span>
              <div>
                <h3>{principle.title}</h3>
                <p>{principle.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="cta-band reveal">
        <div>
          <h2>Bring one skill. Leave with another.</h2>
          <p className="muted">Your first 10 Skill Coins are on us.</p>
        </div>
        <Link className="btn btn-primary" to="/signup">
          Create your profile
        </Link>
      </section>
    </div>
  );
}
