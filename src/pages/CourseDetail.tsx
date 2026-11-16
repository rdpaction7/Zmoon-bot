import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import {
  createReport,
  getCourse,
  listEnrollments,
  listReviews,
  purchaseCourse,
  saveReview,
} from "../lib/api";
import type { Course, Review } from "../lib/types";
import {
  Badge,
  Button,
  Card,
  ErrorText,
  Field,
  Modal,
  Skeleton,
  Stars,
  Textarea,
  useToast,
} from "../components/ui";

export default function CourseDetail() {
  const { courseId = "" } = useParams();
  const { user, isDemo, refreshProfile } = useAuth();
  const { push } = useToast();

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [enrolled, setEnrolled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const found = await getCourse(courseId);
        if (cancelled) return;
        if (!found) {
          setError("That course could not be found.");
          return;
        }
        setCourse(found);
        const [enrollments, courseReviews] = await Promise.all([
          user ? listEnrollments(user.id).catch(() => []) : Promise.resolve([]),
          listReviews(courseId).catch(() => []),
        ]);
        if (cancelled) return;
        setEnrolled(enrollments.some((entry) => entry.courseId === courseId));
        setReviews(courseReviews);
        const mine = courseReviews.find((review) => review.userId === user?.id);
        if (mine) {
          setReviewRating(mine.rating);
          setReviewText(mine.text);
        }
      } catch (caught: any) {
        if (!cancelled) setError(caught?.message || "Could not load this course.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [courseId, user]);

  async function buy() {
    if (!user || !course) return;
    setError("");
    setBusy(true);
    try {
      const result = await purchaseCourse(user.id, course.id);
      setEnrolled(true);
      setConfirmOpen(false);
      await refreshProfile().catch(() => {});
      push(
        result.alreadyEnrolled
          ? "You were already enrolled — nothing was charged."
          : result.charged === 0
            ? "Enrolled. This course is free."
            : `Enrolled. ${result.charged} Skill Coins spent.`,
        "success",
      );
    } catch (caught: any) {
      setError(caught?.message || "The purchase could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  async function submitReview(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !course) return;
    if (reviewText.trim().length > 0 && reviewText.trim().length < 10) {
      return push("Add a little more detail to your review (10+ characters).", "error");
    }
    setReviewBusy(true);
    try {
      await saveReview({ courseId: course.id, user, rating: reviewRating, text: reviewText });
      setReviews(await listReviews(course.id));
      push("Review saved.", "success");
    } catch (caught: any) {
      push(caught?.message || "Could not save your review.", "error");
    } finally {
      setReviewBusy(false);
    }
  }

  async function sendReport() {
    if (!user || !course) return;
    if (reportReason.trim().length < 5) return push("Add a short reason.", "error");
    try {
      await createReport({
        reporter: user,
        targetType: "course",
        targetId: course.id,
        reason: reportReason.trim(),
      });
      setReportOpen(false);
      setReportReason("");
      push("Report sent.", "success");
    } catch (caught: any) {
      push(caught?.message || "Could not send the report.", "error");
    }
  }

  if (loading) {
    return (
      <div className="page">
        <Skeleton lines={8} />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="page page-narrow">
        <Card className="card-pad">
          <h1>Course not found</h1>
          <p className="muted">{error || "It may have been removed or is not published yet."}</p>
          <Link className="btn btn-secondary" to="/courses">
            Back to courses
          </Link>
        </Card>
      </div>
    );
  }

  const isOwner = user?.id === course.creatorId;
  const isPublic = course.status === "approved";
  const average = reviews.length
    ? reviews.reduce((total, review) => total + review.rating, 0) / reviews.length
    : 0;

  return (
    <div className="page">
      <div className="course-hero">
        <div className="course-hero-media">
          {course.thumbnailUrl ? (
            <img src={course.thumbnailUrl} alt="" />
          ) : (
            <span className="thumb-fallback large">{course.title.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div className="course-hero-copy">
          <div className="pill-row">
            <Badge>{course.category}</Badge>
            <Badge tone="neutral">{course.level}</Badge>
            <Badge tone={isPublic ? "positive" : "warning"}>{course.status}</Badge>
            <Badge tone="accent">{course.price === 0 ? "Free" : `${course.price} Skill Coins`}</Badge>
          </div>
          <h1>{course.title}</h1>
          <div className="row wrap">
            <span className="muted">
              by{" "}
              <Link
                className="link"
                to={`/u/${course.creatorName.toLowerCase().replace(/[^a-z0-9_]/g, "")}`}
              >
                {course.creatorName}
              </Link>
            </span>
            <span className="muted small">·</span>
            <span className="muted small">{course.enrollmentCount || 0} enrolled</span>
            {reviews.length > 0 && (
              <>
                <span className="muted small">·</span>
                <Stars value={average} count={reviews.length} />
              </>
            )}
          </div>
          <p>{course.description}</p>

          <ErrorText>{error}</ErrorText>

          <div className="row wrap">
            {enrolled ? (
              <Badge tone="positive">Enrolled — you have access</Badge>
            ) : isOwner ? (
              <Link className="btn btn-secondary" to="/studio">
                Manage this course
              </Link>
            ) : !user ? (
              <Link className="btn btn-primary" to={`/login?next=/courses/${course.id}`}>
                Sign in to enrol
              </Link>
            ) : isDemo ? (
              <Button disabled>Demo accounts cannot enrol</Button>
            ) : isPublic ? (
              <Button onClick={() => setConfirmOpen(true)}>
                {course.price === 0 ? "Enrol for free" : `Enrol for ${course.price} coins`}
              </Button>
            ) : (
              <Badge tone="warning">Not available yet</Badge>
            )}
            {user && !isOwner && (
              <Button variant="ghost" onClick={() => setReportOpen(true)}>
                Report
              </Button>
            )}
          </div>
        </div>
      </div>

      {(enrolled || isOwner) && (
        <Card className="card-pad">
          <h2>Course material</h2>
          {!course.mediaUrl ? (
            <p className="muted small">The creator has not attached material to this course yet.</p>
          ) : course.mediaType === "video" ? (
            <video className="course-media" controls src={course.mediaUrl} />
          ) : course.mediaType === "image" ? (
            <img className="course-media" src={course.mediaUrl} alt="" />
          ) : (
            <a className="btn btn-secondary" href={course.mediaUrl} target="_blank" rel="noreferrer">
              Open course file
            </a>
          )}
        </Card>
      )}

      <Card className="card-pad">
        <div className="between">
          <h2>Reviews</h2>
          {reviews.length > 0 && <Stars value={average} count={reviews.length} />}
        </div>

        {enrolled && !isDemo && (
          <form className="review-form" onSubmit={submitReview}>
            <div className="rating-input" role="radiogroup" aria-label="Your rating">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  role="radio"
                  aria-checked={reviewRating === star}
                  aria-label={`${star} star${star === 1 ? "" : "s"}`}
                  className={reviewRating >= star ? "star star-on star-btn" : "star star-btn"}
                  onClick={() => setReviewRating(star)}
                >
                  ★
                </button>
              ))}
            </div>
            <Field label="Your review" hint="Optional, up to 600 characters.">
              <Textarea
                rows={3}
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
                placeholder="What did you learn? Was it clear?"
              />
            </Field>
            <Button type="submit" size="sm" loading={reviewBusy}>
              Save review
            </Button>
          </form>
        )}

        {reviews.length === 0 ? (
          <p className="muted small">No reviews yet. Learners who enrol can leave one.</p>
        ) : (
          <div className="review-list">
            {reviews.map((review) => (
              <article className="review" key={review.id}>
                <div className="between">
                  <strong className="small">{review.userName}</strong>
                  <Stars value={review.rating} />
                </div>
                {review.text && <p className="small">{review.text}</p>}
                <span className="muted small">{new Date(review.createdAt).toLocaleDateString()}</span>
              </article>
            ))}
          </div>
        )}
      </Card>

      <Modal
        open={confirmOpen}
        title={course.price === 0 ? "Enrol in this course?" : `Spend ${course.price} Skill Coins?`}
        onClose={() => setConfirmOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={buy} loading={busy}>
              Confirm
            </Button>
          </>
        }
      >
        <p>
          <strong>{course.title}</strong> by {course.creatorName}.
        </p>
        <p className="muted small">
          {course.price === 0
            ? "This course is free. No coins will be taken."
            : `This takes ${course.price} Skill Coins from your balance of ${user?.balance ?? 0}. The charge and enrolment happen in one transaction, so a double click cannot charge twice.`}
        </p>
        <ErrorText>{error}</ErrorText>
      </Modal>

      <Modal
        open={reportOpen}
        title="Report this course"
        onClose={() => setReportOpen(false)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setReportOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={sendReport}>
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
            placeholder="Misleading content, spam, copyright…"
          />
        </Field>
      </Modal>
    </div>
  );
}
