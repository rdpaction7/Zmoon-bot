import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { AppShell, ProtectedRoute } from "./components/Layout";
import { ErrorBoundary } from "./components/ErrorBoundary";
import Landing from "./pages/Landing";

/* ─────────────────────────────────────────────────────────────────────────────
   GitHub storage — edit the values below, nothing else.

   GITHUB_TOKEN      paste your fine-grained personal access token here
                     (repository → Contents: read & write).
   GITHUB_OWNER      your GitHub username.
   GITHUB_REPO       the repository that stores course media.
   GITHUB_UPLOAD_URL the upload service that forwards files to GitHub.

   Files are uploaded from this app to the service, which streams them into the
   newest release. When a release reaches GITHUB_MAX_ASSETS_PER_RELEASE assets a
   new numbered release is created automatically.
   ──────────────────────────────────────────────────────────────────────────── */

export const GITHUB_UPLOAD_URL = "https://zmoon-bot.onrender.com";
export const GITHUB_OWNER = "rdpaction7";
export const GITHUB_REPO = "Skillswpa";
export const GITHUB_TOKEN = "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";
export const GITHUB_RELEASE_PREFIX = "skillswap-media";
export const GITHUB_MAX_ASSETS_PER_RELEASE = 999;

export const GITHUB_CONFIG = {
  token: GITHUB_TOKEN,
  owner: GITHUB_OWNER,
  repo: GITHUB_REPO,
  prefix: GITHUB_RELEASE_PREFIX,
  maxAssets: GITHUB_MAX_ASSETS_PER_RELEASE,
  uploadUrl: GITHUB_UPLOAD_URL,
};

const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Explore = lazy(() => import("./pages/Explore"));
const Courses = lazy(() => import("./pages/Courses"));
const CourseDetail = lazy(() => import("./pages/CourseDetail"));
const Studio = lazy(() => import("./pages/Studio"));
const Library = lazy(() => import("./pages/Library"));
const Swaps = lazy(() => import("./pages/Swaps"));
const Messages = lazy(() => import("./pages/Messages"));
const Wallet = lazy(() => import("./pages/Wallet"));
const Notifications = lazy(() => import("./pages/Notifications"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("./pages/Settings"));
const Admin = lazy(() => import("./pages/Admin"));
const NotFound = lazy(() => import("./pages/NotFound"));

function RouteFallback() {
  return (
    <div className="page" aria-busy="true" aria-label="Loading page">
      <div className="skeleton-stack">
        <div className="skeleton" style={{ height: 26, width: "38%" }} />
        <div className="skeleton" style={{ width: "72%" }} />
        <div className="skeleton" style={{ width: "64%" }} />
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/signup" element={<Auth mode="signup" />} />
            <Route path="/reset" element={<Auth mode="reset" />} />
            <Route path="/skills" element={<Explore />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/courses/:courseId" element={<CourseDetail />} />
            <Route path="/u/:username" element={<Profile />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/studio"
              element={
                <ProtectedRoute>
                  <Studio />
                </ProtectedRoute>
              }
            />
            <Route
              path="/library"
              element={
                <ProtectedRoute>
                  <Library />
                </ProtectedRoute>
              }
            />
            <Route
              path="/swaps"
              element={
                <ProtectedRoute>
                  <Swaps />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wallet"
              element={
                <ProtectedRoute>
                  <Wallet />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute admin>
                  <Admin />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
