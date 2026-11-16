import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { listCategories, listCourses } from "../lib/api";
import type { Course, SkillCategory } from "../lib/types";
import { str, titleOf } from "../lib/text";
import { Badge, LinkButton, EmptyState, SearchInput, Select, Skeleton } from "../components/ui";

export default function Courses() {
  const [params] = useSearchParams();
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<SkillCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [term, setTerm] = useState(params.get("q") || "");
  const [category, setCategory] = useState(params.get("category") || "all");
  const [level, setLevel] = useState("all");
  const [price, setPrice] = useState("all");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    Promise.all([listCourses(), listCategories().catch(() => [])])
      .then(([all, cats]) => {
        setCourses(all.filter((course) => course.status === "approved"));
        setCategories(cats);
      })
      .catch((caught) => setError(caught?.message || "Could not load courses."))
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(() => {
    const query = term.trim().toLowerCase();
    let list = courses.filter((course) => {
      if (category !== "all" && course.category !== category) return false;
      if (level !== "all" && course.level !== level) return false;
      if (price === "free" && course.price !== 0) return false;
      if (price === "paid" && course.price === 0) return false;
      if (!query) return true;
      return [course.title, course.description, course.creatorName, course.category]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
    if (sort === "price-asc") list = [...list].sort((a, b) => a.price - b.price);
    else if (sort === "price-desc") list = [...list].sort((a, b) => b.price - a.price);
    else if (sort === "popular") list = [...list].sort((a, b) => b.enrollmentCount - a.enrollmentCount);
    else list = [...list].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return list;
  }, [courses, term, category, level, price, sort]);

  const filtersActive = Boolean(term.trim()) || category !== "all" || level !== "all" || price !== "all" || sort !== "newest";

  function clearFilters() {
    setTerm("");
    setCategory("all");
    setLevel("all");
    setPrice("all");
    setSort("newest");
  }

  return (
    <div className="page">
      <header className="section-head between">
        <div>
          <span className="eyebrow">Course marketplace</span>
          <h1>Courses from real teachers</h1>
          <p className="muted">Free to enrol, or up to 50 Skill Coins. No subscriptions, ever.</p>
        </div>
        <Link className="btn btn-primary" to="/studio">
          Teach a course
        </Link>
      </header>

      <div className="filter-bar">
        <SearchInput
          value={term}
          onChange={setTerm}
          placeholder="Search courses or creators"
          label="Search courses"
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
        <Select value={price} onChange={(event) => setPrice(event.target.value)} aria-label="Price">
          <option value="all">Any price</option>
          <option value="free">Free</option>
          <option value="paid">Paid</option>
        </Select>
        <Select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort">
          <option value="newest">Newest</option>
          <option value="popular">Most enrolled</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
        </Select>
      </div>

      {!loading && (
        <div className="filter-meta">
          <span>
            {visible.length} course{visible.length === 1 ? "" : "s"}
            {filtersActive ? " match your filters" : " published by the community"}
          </span>
          {filtersActive && (
            <button type="button" className="filter-clear" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}

      {error && <p className="error-text">{error}</p>}

      {loading ? (
        <Skeleton lines={6} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="book"
          title="No courses match yet"
          body="Nothing published under these filters. Try clearing them, or publish the first course yourself."
          action={
            <LinkButton to="/studio" variant="secondary">
              Open creator studio
            </LinkButton>
          }
        />
      ) : (
        <div className="grid grid-3">
          {visible.map((course) => (
            <Link key={course.id} to={`/courses/${course.id}`} className="course-card card">
              <div className="thumb">
                {course.thumbnailUrl ? (
                  <img src={course.thumbnailUrl} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className="thumb-fallback">{titleOf(course.title).slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <div className="course-body">
                <div className="pill-row">
                  <Badge>{course.category}</Badge>
                  <Badge tone="neutral">{course.level}</Badge>
                  <Badge tone="accent">{course.price === 0 ? "Free" : `${course.price} coins`}</Badge>
                </div>
                <h3>{titleOf(course.title)}</h3>
                <p className="muted small clamp-3">{str(course.description)}</p>
                <p className="muted small">
                  {str(course.creatorName, "a member")} · {course.enrollmentCount || 0} enrolled
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
