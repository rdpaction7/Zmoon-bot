# SkillSwap

A skill-swapping community: members teach what they know, learn what they want,
swap one-to-one for free, and publish courses paid for with Skill Coins.

React + Vite + TypeScript frontend, Firebase Authentication and Firestore for real
cross-device persistence, and course media stored as GitHub Release assets.

---

## Run it

```bash
npm install
npm run dev            # http://localhost:3000
npm run build          # typecheck + production bundle in dist/
npm run preview        # serve the built bundle
```

---

## 1. Firebase (one time, required)

The project `skullswap` is already wired up in `src/lib/firebase.ts`.

1. **Authentication → Sign-in method**: enable **Email/Password**. Enable
   **Anonymous** if you want the read-only demo visitor.
2. **Authentication → Settings → Authorized domains**: add the domain you deploy to.
3. **Firestore Database**: create the database.
4. Deploy the rules and indexes (until you do, every read is denied and the app
   shows empty states):

```bash
npm install -g firebase-tools
firebase login
firebase use skullswap
firebase deploy --only firestore:rules,firestore:indexes
```

5. **Admin**: sign up with `tanishqlalwani202@gmail.com`. That email gets the
   `admin` role on profile creation (allowlist in `src/lib/firebase.ts` and
   `firestore.rules`), which unlocks `/admin`. There is no admin password in the
   code.

---

## 2. GitHub storage — configure once in `src/App.tsx`

Open `src/App.tsx`. The block at the top is the only thing you edit:

```ts
export const GITHUB_UPLOAD_URL = "https://zmoon-bot.onrender.com";
export const GITHUB_OWNER = "rdpaction7";
export const GITHUB_REPO = "Skillswpa";
export const GITHUB_TOKEN = "";        // ← paste your fine-grained PAT here
```

The token needs **Contents: read & write** on that one repository. You can also
paste it at runtime from **Settings → Media storage** instead; whatever is entered
there is kept in that browser's `localStorage`.

### How an upload works

```
browser → App.tsx upload code → zmoon-bot.onrender.com/upload → GitHub release
```

- The **frontend** owns the upload logic (`src/lib/github.ts`): it POSTs the file
  with upload progress (`XMLHttpRequest`) and reads the resulting
  `browser_download_url`.
- The **service** (`upload-service/`) exists because `uploads.github.com` sends no
  CORS headers — a browser cannot post asset bytes there directly. It streams the
  request into the newest release without buffering or touching disk.
- Listing releases, counting assets and creating the next release are done from
  the frontend against `api.github.com`, which does allow cross-origin calls.
- **Rollover**: when a release reaches 1,000 assets (`GITHUB_MAX_ASSETS_PER_RELEASE`),
  the next upload creates `skillswap-media-002`, then `-003`, and so on.

### Deploying / redeploying the upload service

`upload-service/` has no dependencies:

```bash
cd upload-service
PORT=10000 node index.js
```

Endpoints:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Liveness + repository info |
| POST | `/upload?filename=name` | Streams the body into the newest release. `Authorization: Bearer <github token>` |

On Render: root directory `upload-service`, build `npm install`, start
`npm start`. Set `GITHUB_TOKEN` in the service environment if you would rather the
token live there than in the frontend — the service accepts either, preferring the
caller's token.

> ⚠️ A token in `GITHUB_TOKEN` inside `App.tsx` is bundled into the public
> JavaScript. Anyone who opens the site can read it. That is fine only for a
> short-lived, single-repository, contents-only token that you are willing to
> rotate. For a long-lived deployment, set the token on the service instead and
> leave the `App.tsx` constant empty.

---

## Feature map

| Area | Route | Notes |
| --- | --- | --- |
| Landing | `/` | Hero, live community stats, how swapping works, featured courses, principles |
| Auth | `/login`, `/signup`, `/reset` | Email/password, no verification step, password reset email, read-only demo |
| Dashboard | `/dashboard` | Balance, streak, enrolments, pending swaps, activity |
| Discover | `/skills` | Search, category/level filters, sort, swap requests, reports |
| Courses | `/courses`, `/courses/:id` | Search, filters, sorting, detail, reviews, enrolment |
| Creator studio | `/studio` | Drafts, price 0–50, media upload, submit for review |
| Library | `/library` | Enrolled courses and their material |
| Swaps | `/swaps` | Accept, decline, cancel, complete |
| Messages | `/messages` | Conversation list, realtime thread, unread counts |
| Wallet | `/wallet` | Balance, ledger, streak claim, labelled ad placeholder |
| Notifications | `/notifications` | Swap, reward and enrolment events |
| Profile | `/u/:username` | Public profile, skills, goals, courses |
| Settings | `/settings` | Profile editing, storage configuration and connection test |
| Admin | `/admin` | Users, moderation, reports, ledger, audit log, `/List` `/Givem` `/Takem` |

### Skill Coin economy

- Coins are spent **only** on paid courses (1–50). Free courses cost nothing.
- Swaps, messages, profile edits and listing skills are always free.
- New accounts start with 10 coins.
- Daily streak: +1 coin, +2 extra every 7th consecutive day, once per UTC day.
- Creators earn 1 coin per **50 unique enrolments** per course, awarded once per
  threshold (tracked as `rewardedThresholds` on the course).
- Every balance change writes a ledger entry with reason, amount and resulting balance.
- Purchases run in a transaction: price read from the course document, balance
  check and enrolment write atomic, enrolment id `courseId_uid` so a double click
  cannot charge twice, creators cannot buy their own course.

---

## Production polish included

- Route-level code splitting (each page is its own chunk) and a top-level error boundary.
- Accessible modals: focus trap, Escape to close, scroll lock, focus restore.
- `ConfirmDialog` instead of `window.confirm`, toasts with `aria-live`, skip-to-content link.
- Per-route document titles, favicon, theme colour, social metadata.
- Skeleton loaders, empty states, and recoverable error states on every data view.
- Auth initialised independently of Firestore, so a database outage never blocks sign-in.

---

## Security notes

- Roles and account status cannot be self-assigned; the rules require the admin
  email and block role/status changes on update.
- Skills and courses created by members start `pending`/`draft`; creators cannot
  approve their own content.
- Conversations and messages are readable only by participants; reports and audit
  logs are admin-only and audit logs are append-only.
- **Known limitation:** coin and enrolment writes happen client-side inside a
  Firestore transaction. That prevents accidental double charges and races, but a
  hostile client could still forge a balance. To harden it, move
  `purchaseCourse`, `claimDailyStreak`, `claimAdPlaceholder` and
  `runAdminCommand` into the upload service with the Firebase Admin SDK and deny
  client writes to `users.balance`, `coinTransactions` and `enrollments`.

---

## Project layout

```
src/
  App.tsx                 GitHub placeholders + routes
  lib/                    firebase init, Firestore services, GitHub upload, settings, types
  state/AuthContext.tsx   auth + profile state, demo mode
  components/             UI primitives, layout, media uploader, error boundary
  pages/                  16 route screens
upload-service/           trusted upload service (no dependencies)
firestore.rules           deployable security rules
firestore.indexes.json    composite indexes
firebase.json             rules/indexes/hosting config
```

## Verified in this build

- `npm run build` — TypeScript and Vite pass, pages split into separate chunks.
- Landing page renders in a real browser with no console errors; document titles,
  favicon and skip link are present.
- Upload service: `/health` OK, CORS preflight returns 204 with the right headers,
  a bad token returns a clean `502 {"error":"Bad credentials","github_status":401}`
  and the process stays healthy.

Not verifiable here without your credentials: sign-in/sign-up against the live
Firebase project, real uploads with your token, and admin actions on live data.
