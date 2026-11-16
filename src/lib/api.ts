import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import type {
  AppNotification,
  AuditLog,
  CoinTransaction,
  Conversation,
  Course,
  Enrollment,
  Message,
  Report,
  Review,
  Skill,
  SkillCategory,
  Streak,
  SwapRequest,
  UserProfile,
} from "./types";

const nowIso = () => new Date().toISOString();
const todayUtc = () => new Date().toISOString().slice(0, 10);
const yesterdayUtc = () => new Date(Date.now() - 86400000).toISOString().slice(0, 10);

function dataOf<T>(snap: any): T {
  return { id: snap.id, ...(snap.data() as object) } as T;
}

/* ------------------------------------------------------------------ profiles */

export async function getProfile(uid: string): Promise<UserProfile | null> {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? dataOf<UserProfile>(snap) : null;
}

export async function createProfile(profile: UserProfile): Promise<void> {
  const batch = writeBatch(db);
  batch.set(doc(db, "users", profile.id), {
    ...profile,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  batch.set(doc(db, "streaks", profile.id), {
    current: 0,
    longest: 0,
    lastClaimDay: null,
    lastClaimAt: null,
    history: [],
  });
  try {
    batch.set(doc(db, "usernames", profile.username), { uid: profile.id });
  } catch {
    /* username index is best effort */
  }
  await batch.commit();
}

export async function touchLogin(uid: string): Promise<void> {
  await updateDoc(doc(db, "users", uid), { lastLoginAt: nowIso() });
}

export async function updateProfile(uid: string, patch: Partial<UserProfile>): Promise<void> {
  const safe: any = { ...patch, updatedAt: nowIso() };
  delete safe.role;
  delete safe.balance;
  delete safe.status;
  delete safe.id;
  await updateDoc(doc(db, "users", uid), safe);
}

export async function getProfileByUsername(username: string): Promise<UserProfile | null> {
  const index = await getDoc(doc(db, "usernames", username.toLowerCase()));
  if (!index.exists()) return null;
  return getProfile(index.data().uid);
}

export async function listCreators(max = 6): Promise<UserProfile[]> {
  const snap = await getDocs(query(collection(db, "users"), limit(50)));
  return snap.docs.map((entry) => dataOf<UserProfile>(entry)).slice(0, max);
}

export async function listAllUsers(): Promise<UserProfile[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((entry) => dataOf<UserProfile>(entry));
}

/* -------------------------------------------------------------------- skills */

export async function listSkills(): Promise<Skill[]> {
  const snap = await getDocs(query(collection(db, "skills"), orderBy("createdAt", "desc")));
  return snap.docs.map((entry) => dataOf<Skill>(entry));
}

export async function createSkill(input: {
  owner: UserProfile;
  title: string;
  category: string;
  level: Skill["level"];
  description: string;
}): Promise<void> {
  await addDoc(collection(db, "skills"), {
    ownerId: input.owner.id,
    ownerName: input.owner.displayName,
    title: input.title,
    category: input.category,
    level: input.level,
    description: input.description,
    status: "pending",
    createdAt: nowIso(),
  });
}

export async function deleteSkill(skillId: string): Promise<void> {
  await deleteDoc(doc(db, "skills", skillId));
}

export async function setSkillStatus(skillId: string, status: Skill["status"]): Promise<void> {
  await updateDoc(doc(db, "skills", skillId), { status });
}

export async function listCategories(): Promise<SkillCategory[]> {
  const snap = await getDocs(query(collection(db, "skillCategories"), orderBy("order", "asc")));
  return snap.docs.map((entry) => dataOf<SkillCategory>(entry));
}

export async function addCategory(name: string): Promise<void> {
  await addDoc(collection(db, "skillCategories"), { name, order: Date.now() });
}

export async function removeCategory(categoryId: string): Promise<void> {
  await deleteDoc(doc(db, "skillCategories", categoryId));
}

/* --------------------------------------------------------------------- swaps */

export async function listSwaps(uid: string): Promise<SwapRequest[]> {
  const [sent, received] = await Promise.all([
    getDocs(query(collection(db, "swapRequests"), where("fromUserId", "==", uid))),
    getDocs(query(collection(db, "swapRequests"), where("toUserId", "==", uid))),
  ]);
  const map = new Map<string, SwapRequest>();
  [...sent.docs, ...received.docs].forEach((entry) => map.set(entry.id, dataOf<SwapRequest>(entry)));
  return [...map.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function createSwap(input: {
  from: UserProfile;
  to: UserProfile;
  offeredSkill: string;
  wantedSkill: string;
  message: string;
}): Promise<void> {
  const existing = await getDocs(
    query(
      collection(db, "swapRequests"),
      where("fromUserId", "==", input.from.id),
      where("toUserId", "==", input.to.id),
      where("status", "==", "pending"),
    ),
  );
  if (!existing.empty) {
    throw new Error("You already have a pending swap request with this member.");
  }
  await addDoc(collection(db, "swapRequests"), {
    fromUserId: input.from.id,
    fromName: input.from.displayName,
    toUserId: input.to.id,
    toName: input.to.displayName,
    offeredSkill: input.offeredSkill,
    wantedSkill: input.wantedSkill,
    message: input.message,
    status: "pending",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  await notify(input.to.id, {
    type: "swap",
    title: "New swap request",
    body: `${input.from.displayName} offered ${input.offeredSkill} for ${input.wantedSkill}.`,
    link: "/swaps",
  });
}

export async function updateSwapStatus(swap: SwapRequest, status: SwapRequest["status"]) {
  await updateDoc(doc(db, "swapRequests", swap.id), { status, updatedAt: nowIso() });
  const target = status === "accepted" ? swap.fromUserId : swap.toUserId;
  await notify(target, {
    type: "swap",
    title: `Swap ${status}`,
    body: `${swap.offeredSkill} ↔ ${swap.wantedSkill} was ${status}.`,
    link: "/swaps",
  });
  if (status === "accepted") {
    await ensureConversation(swap.fromUserId, swap.toUserId, swap.fromName, swap.toName);
  }
}

/* ------------------------------------------------------------------- courses */

export async function listCourses(): Promise<Course[]> {
  const snap = await getDocs(query(collection(db, "courses"), orderBy("createdAt", "desc")));
  return snap.docs.map((entry) => dataOf<Course>(entry));
}

export async function getCourse(courseId: string): Promise<Course | null> {
  const snap = await getDoc(doc(db, "courses", courseId));
  return snap.exists() ? dataOf<Course>(snap) : null;
}

export async function saveCourse(
  input: Partial<Course> & { creatorId: string; creatorName: string },
  courseId?: string,
): Promise<string> {
  const payload = {
    creatorId: input.creatorId,
    creatorName: input.creatorName,
    title: input.title || "",
    description: input.description || "",
    category: input.category || "General",
    level: input.level || "beginner",
    thumbnailUrl: input.thumbnailUrl || "",
    mediaUrl: input.mediaUrl || "",
    mediaType: input.mediaType || "none",
    price: clampPrice(input.price),
    status: input.status || "draft",
    updatedAt: nowIso(),
  };
  if (courseId) {
    await updateDoc(doc(db, "courses", courseId), payload);
    return courseId;
  }
  const ref = await addDoc(collection(db, "courses"), {
    ...payload,
    enrollmentCount: 0,
    rewardedThresholds: 0,
    createdAt: nowIso(),
  });
  return ref.id;
}

export function clampPrice(value: unknown): number {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(parsed, 50);
}

export async function submitCourse(courseId: string): Promise<void> {
  await updateDoc(doc(db, "courses", courseId), { status: "pending", updatedAt: nowIso() });
}

export async function setCourseStatus(courseId: string, status: Course["status"]): Promise<void> {
  await updateDoc(doc(db, "courses", courseId), { status, updatedAt: nowIso() });
}

export async function listEnrollments(uid: string): Promise<Enrollment[]> {
  const snap = await getDocs(query(collection(db, "enrollments"), where("userId", "==", uid)));
  return snap.docs.map((entry) => dataOf<Enrollment>(entry));
}

export interface PurchaseResult {
  enrolled: boolean;
  charged: number;
  alreadyEnrolled: boolean;
}

/**
 * Purchase / enrol in one transaction.
 *
 * The price is read from the course document (never from the caller), the
 * balance check and the enrollment write happen atomically, and the enrollment
 * id is derived from course+user so a double click can never charge twice.
 * Creators earn 1 Skill Coin per 50 unique enrollments, awarded once per
 * threshold.
 */
export async function purchaseCourse(
  uid: string,
  courseId: string,
): Promise<PurchaseResult> {
  const courseRef = doc(db, "courses", courseId);
  const userRef = doc(db, "users", uid);
  const enrollmentRef = doc(db, "enrollments", `${courseId}_${uid}`);

  const first = await getDoc(courseRef);
  if (!first.exists()) throw new Error("That course no longer exists.");
  const courseData = first.data() as Course;
  if (courseData.status !== "approved") throw new Error("This course is not available yet.");
  if (courseData.creatorId === uid) throw new Error("You cannot purchase your own course.");

  const creatorRef = doc(db, "users", courseData.creatorId);
  const ledgerRef = doc(collection(db, "coinTransactions"));

  return runTransaction(db, async (tx) => {
    const [courseSnap, userSnap, enrollSnap, creatorSnap] = await Promise.all([
      tx.get(courseRef),
      tx.get(userRef),
      tx.get(enrollmentRef),
      tx.get(creatorRef),
    ]);
    if (!courseSnap.exists()) throw new Error("That course no longer exists.");
    if (enrollSnap.exists()) {
      return { enrolled: true, charged: 0, alreadyEnrolled: true };
    }
    const price = clampPrice(courseSnap.data().price);
    const balance = Number(userSnap.data()?.balance || 0);
    if (price > balance) {
      throw new Error(`You need ${price - balance} more Skill Coins for this course.`);
    }
    const balanceAfter = balance - price;
    const creator = creatorSnap.exists() ? creatorSnap.data() : null;

    tx.update(userRef, { balance: balanceAfter, updatedAt: nowIso() });
    tx.set(enrollmentRef, {
      courseId,
      userId: uid,
      pricePaid: price,
      createdAt: nowIso(),
    });
    const newCount = Number(courseSnap.data().enrollmentCount || 0) + 1;
    const rewarded = Number(courseSnap.data().rewardedThresholds || 0);
    const earnedThresholds = Math.floor(newCount / 50);
    const creatorReward = earnedThresholds > rewarded ? earnedThresholds - rewarded : 0;

    tx.update(courseRef, {
      enrollmentCount: newCount,
      rewardedThresholds: Math.max(rewarded, earnedThresholds),
    });

    if (price > 0) {
      tx.set(ledgerRef, {
        userId: uid,
        amount: -price,
        reason: `Course purchase: ${courseSnap.data().title}`,
        courseId,
        balanceAfter,
        createdAt: nowIso(),
      });
    }

    if (creatorReward > 0 && creator) {
      tx.update(creatorRef, {
        balance: Number(creator.balance || 0) + creatorReward,
        updatedAt: nowIso(),
      });
      tx.set(doc(collection(db, "coinTransactions")), {
        userId: courseData.creatorId,
        amount: creatorReward,
        reason: `Creator reward — 50 unique enrolments in ${courseSnap.data().title}`,
        courseId,
        balanceAfter: Number(creator.balance || 0) + creatorReward,
        createdAt: nowIso(),
      });
      tx.set(doc(collection(db, "notifications")), {
        userId: courseData.creatorId,
        type: "reward",
        title: "Creator reward",
        body: `You earned ${creatorReward} Skill Coin for reaching ${earnedThresholds * 50} enrolments.`,
        link: "/wallet",
        read: false,
        createdAt: nowIso(),
      });
    }

    return { enrolled: true, charged: price, alreadyEnrolled: false };
  });
}

/* -------------------------------------------------------------------- wallet */

export async function listTransactions(uid: string): Promise<CoinTransaction[]> {
  const snap = await getDocs(
    query(collection(db, "coinTransactions"), where("userId", "==", uid), limit(200)),
  );
  return snap.docs
    .map((entry) => dataOf<CoinTransaction>(entry))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function getStreak(uid: string): Promise<Streak | null> {
  const snap = await getDoc(doc(db, "streaks", uid));
  return snap.exists() ? (snap.data() as Streak) : null;
}

export interface StreakClaimResult {
  awarded: number;
  streak: number;
  alreadyClaimed: boolean;
}

export async function claimDailyStreak(uid: string): Promise<StreakClaimResult> {
  const streakRef = doc(db, "streaks", uid);
  const userRef = doc(db, "users", uid);
  const ledgerRef = doc(collection(db, "coinTransactions"));

  return runTransaction(db, async (tx) => {
    const [streakSnap, userSnap] = await Promise.all([tx.get(streakRef), tx.get(userRef)]);
    const data = streakSnap.exists() ? (streakSnap.data() as Streak) : null;
    const today = todayUtc();
    if (data?.lastClaimDay === today) {
      return { awarded: 0, streak: data.current, alreadyClaimed: true };
    }
    const continued = data?.lastClaimDay === yesterdayUtc();
    const streak = continued ? Number(data?.current || 0) + 1 : 1;
    const bonus = streak % 7 === 0 ? 2 : 0;
    const awarded = 1 + bonus;
    const balance = Number(userSnap.data()?.balance || 0);

    tx.set(
      streakRef,
      {
        current: streak,
        longest: Math.max(streak, Number(data?.longest || 0)),
        lastClaimDay: today,
        lastClaimAt: nowIso(),
        history: [...(data?.history || []).slice(-59), today],
      },
      { merge: true },
    );
    tx.update(userRef, { balance: balance + awarded, updatedAt: nowIso() });
    tx.set(ledgerRef, {
      userId: uid,
      amount: awarded,
      reason: bonus ? `Daily streak — day ${streak} (7-day bonus)` : `Daily streak — day ${streak}`,
      balanceAfter: balance + awarded,
      createdAt: nowIso(),
    });
    return { awarded, streak, alreadyClaimed: false };
  });
}

/**
 * Rewarded-ad placeholder. No ad provider is configured, so this records an
 * explicit "placeholder" claim (once per UTC day) and never pretends a real ad
 * was watched.
 */
export async function claimAdPlaceholder(uid: string): Promise<{ awarded: number; alreadyClaimed: boolean }> {
  const claimRef = doc(db, "rewardClaims", `${uid}_ad_${todayUtc()}`);
  const userRef = doc(db, "users", uid);
  const ledgerRef = doc(collection(db, "coinTransactions"));

  return runTransaction(db, async (tx) => {
    const [claimSnap, userSnap] = await Promise.all([tx.get(claimRef), tx.get(userRef)]);
    if (claimSnap.exists()) return { awarded: 0, alreadyClaimed: true };
    const balance = Number(userSnap.data()?.balance || 0);
    tx.set(claimRef, {
      userId: uid,
      type: "ad_placeholder",
      day: todayUtc(),
      amount: 1,
      verified: false,
      createdAt: nowIso(),
    });
    tx.update(userRef, { balance: balance + 1, updatedAt: nowIso() });
    tx.set(ledgerRef, {
      userId: uid,
      amount: 1,
      reason: "Rewarded ad (placeholder — no ad provider configured)",
      balanceAfter: balance + 1,
      createdAt: nowIso(),
    });
    return { awarded: 1, alreadyClaimed: false };
  });
}

/* ----------------------------------------------------------------- messaging */

export function conversationId(a: string, b: string) {
  return [a, b].sort().join("_");
}

export async function ensureConversation(
  aId: string,
  bId: string,
  aName: string,
  bName: string,
): Promise<string> {
  const id = conversationId(aId, bId);
  const ref = doc(db, "conversations", id);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      participants: [aId, bId],
      participantNames: { [aId]: aName, [bId]: bName },
      lastMessage: "",
      lastMessageAt: nowIso(),
      unread: { [aId]: 0, [bId]: 0 },
    });
  }
  return id;
}

export async function listConversations(uid: string): Promise<Conversation[]> {
  const snap = await getDocs(
    query(collection(db, "conversations"), where("participants", "array-contains", uid)),
  );
  return snap.docs
    .map((entry) => dataOf<Conversation>(entry))
    .sort((a, b) => (a.lastMessageAt < b.lastMessageAt ? 1 : -1));
}

export function watchMessages(convId: string, cb: (messages: Message[]) => void) {
  return onSnapshot(
    query(collection(db, "conversations", convId, "messages"), orderBy("createdAt", "asc")),
    (snap) => cb(snap.docs.map((entry) => dataOf<Message>(entry))),
    () => cb([]),
  );
}

export async function sendMessage(
  conv: Conversation,
  sender: UserProfile,
  text: string,
): Promise<void> {
  const clean = text.trim().slice(0, 2000);
  if (!clean) return;
  await addDoc(collection(db, "conversations", conv.id, "messages"), {
    senderId: sender.id,
    senderName: sender.displayName,
    text: clean,
    createdAt: nowIso(),
  });
  const other = conv.participants.find((entry) => entry !== sender.id);
  await updateDoc(doc(db, "conversations", conv.id), {
    lastMessage: clean.slice(0, 140),
    lastMessageAt: nowIso(),
    [`unread.${other}`]: increment(1),
  });
}

export async function markConversationRead(conv: Conversation, uid: string): Promise<void> {
  await updateDoc(doc(db, "conversations", conv.id), { [`unread.${uid}`]: 0 });
}

/* --------------------------------------------------------------- notifications */

export async function notify(
  userId: string,
  input: { type: string; title: string; body: string; link?: string },
): Promise<void> {
  await addDoc(collection(db, "notifications"), {
    userId,
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link || "",
    read: false,
    createdAt: nowIso(),
  });
}

export async function listNotifications(uid: string): Promise<AppNotification[]> {
  const snap = await getDocs(
    query(collection(db, "notifications"), where("userId", "==", uid), limit(100)),
  );
  return snap.docs
    .map((entry) => dataOf<AppNotification>(entry))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function markNotificationRead(id: string): Promise<void> {
  await updateDoc(doc(db, "notifications", id), { read: true });
}

export async function markAllNotificationsRead(items: AppNotification[]): Promise<void> {
  await Promise.all(items.filter((item) => !item.read).map((item) => markNotificationRead(item.id)));
}

/* -------------------------------------------------------------------- reports */

export async function createReport(input: {
  reporter: UserProfile;
  targetType: Report["targetType"];
  targetId: string;
  reason: string;
}): Promise<void> {
  await addDoc(collection(db, "reports"), {
    reporterId: input.reporter.id,
    reporterName: input.reporter.displayName,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason.slice(0, 1000),
    status: "open",
    createdAt: nowIso(),
  });
}

export async function listReports(): Promise<Report[]> {
  const snap = await getDocs(query(collection(db, "reports"), orderBy("createdAt", "desc")));
  return snap.docs.map((entry) => dataOf<Report>(entry));
}

export async function setReportStatus(id: string, status: Report["status"]): Promise<void> {
  await updateDoc(doc(db, "reports", id), { status });
}

export async function setUserStatus(uid: string, status: UserProfile["status"]): Promise<void> {
  await updateDoc(doc(db, "users", uid), { status });
}

/* -------------------------------------------------------------- admin console */

export async function listAuditLogs(): Promise<AuditLog[]> {
  const snap = await getDocs(query(collection(db, "adminAuditLogs"), orderBy("createdAt", "desc"), limit(100)));
  return snap.docs.map((entry) => dataOf<AuditLog>(entry));
}

async function writeAudit(admin: UserProfile, action: string, detail: string) {
  await addDoc(collection(db, "adminAuditLogs"), {
    adminId: admin.id,
    adminEmail: admin.email,
    action,
    detail,
    createdAt: nowIso(),
  });
}

export interface CommandResult {
  ok: boolean;
  output: string[];
}

/** Parses and executes the admin command console. */
export async function runAdminCommand(admin: UserProfile, raw: string): Promise<CommandResult> {
  const input = raw.trim();
  if (!input.startsWith("/")) {
    return { ok: false, output: ["Commands start with /. Try /help."] };
  }
  const [command, ...args] = input.split(/\s+/);
  const name = command.toLowerCase();

  if (name === "/help") {
    return {
      ok: true,
      output: [
        "/List — list all users",
        "/Givem #user #amount — give Skill Coins",
        "/Takem #user #amount — take Skill Coins",
        "/Givem #me #amount — give yourself Skill Coins",
        "/Takem #me #amount — take your own Skill Coins",
      ],
    };
  }

  if (name === "/list") {
    const users = await listAllUsers();
    return {
      ok: true,
      output: users.map(
        (user) =>
          `${user.id}  @${user.username}  ${user.displayName}  ${user.email}  ${user.balance} coins  ${user.role}`,
      ),
    };
  }

  if (name === "/givem" || name === "/takem") {
    if (args.length < 2) {
      return { ok: false, output: [`Usage: ${command} #user #amount`] };
    }
    const target = args[0];
    const amount = Number(args[1]);
    if (!/^\d+$/.test(args[1]) || !Number.isSafeInteger(amount) || amount <= 0 || amount > 100000) {
      return { ok: false, output: ["Amount must be a positive whole number (1–100000)."] };
    }
    const users = await listAllUsers();
    const key = target.replace(/^#/, "").toLowerCase();
    const matches = users.filter(
      (user) =>
        user.id.toLowerCase() === key ||
        user.username.toLowerCase() === key ||
        user.email.toLowerCase() === key,
    );
    if (key === "me") matches.push(admin);
    if (matches.length === 0) return { ok: false, output: [`No user matches "${target}".`] };
    if (matches.length > 1) {
      return {
        ok: false,
        output: [`"${target}" is ambiguous:`, ...matches.map((user) => `  ${user.id} @${user.username}`)],
      };
    }
    const user = matches[0];
    const delta = name === "/givem" ? amount : -amount;
    const before = user.balance;

    try {
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", user.id);
        const snap = await tx.get(ref);
        const balance = Number(snap.data()?.balance || 0);
        if (balance + delta < 0) {
          throw new Error(`@${user.username} only has ${balance} Skill Coins.`);
        }
        tx.update(ref, { balance: balance + delta, updatedAt: nowIso() });
        tx.set(doc(collection(db, "coinTransactions")), {
          userId: user.id,
          amount: delta,
          reason: `Admin ${name === "/givem" ? "grant" : "deduction"} by ${admin.email}`,
          adminId: admin.id,
          balanceAfter: balance + delta,
          createdAt: nowIso(),
        });
      });
    } catch (error: any) {
      return { ok: false, output: [error?.message || "The balance change failed."] };
    }

    await writeAudit(
      admin,
      name === "/givem" ? "coins.give" : "coins.take",
      `${delta} coins to @${user.username} (${user.id}); balance ${before} → ${before + delta}`,
    );
    return {
      ok: true,
      output: [
        `${name === "/givem" ? "Gave" : "Took"} ${amount} Skill Coins ${name === "/givem" ? "to" : "from"} @${user.username}.`,
        `Balance: ${before} → ${before + delta}`,
      ],
    };
  }

  return { ok: false, output: [`Unknown command ${command}. Try /help.`] };
}

export async function listAllTransactions(): Promise<CoinTransaction[]> {
  const snap = await getDocs(
    query(collection(db, "coinTransactions"), orderBy("createdAt", "desc"), limit(200)),
  );
  return snap.docs.map((entry) => dataOf<CoinTransaction>(entry));
}

/* -------------------------------------------------------------------- reviews */

export async function listReviews(courseId: string): Promise<Review[]> {
  const snap = await getDocs(
    query(collection(db, "reviews"), where("courseId", "==", courseId), limit(200)),
  );
  return snap.docs
    .map((entry) => dataOf<Review>(entry))
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

/** One review per learner per course, replaced if they edit it. */
export async function saveReview(input: {
  courseId: string;
  user: UserProfile;
  rating: number;
  text: string;
}): Promise<void> {
  const rating = Math.max(1, Math.min(5, Math.round(input.rating)));
  await setDoc(doc(db, "reviews", `${input.courseId}_${input.user.id}`), {
    courseId: input.courseId,
    userId: input.user.id,
    userName: input.user.displayName,
    rating,
    text: input.text.trim().slice(0, 600),
    createdAt: nowIso(),
  });
}

export function currentUid(): string | null {
  return auth.currentUser?.uid || null;
}

export { arrayUnion, serverTimestamp };
