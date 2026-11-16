export type Role = "user" | "admin";

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  photoURL?: string;
  bio?: string;
  location?: string;
  interests: string[];
  skillsWanted: string[];
  goals?: string;
  role: Role;
  demo?: boolean;
  status: "active" | "suspended";
  balance: number;
  createdAt?: string;
}

export interface Skill {
  id: string;
  ownerId: string;
  ownerName: string;
  title: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  description: string;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface SkillCategory {
  id: string;
  name: string;
  order: number;
}

export type SwapStatus = "pending" | "accepted" | "rejected" | "cancelled" | "completed";

export interface SwapRequest {
  id: string;
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  offeredSkill: string;
  wantedSkill: string;
  message: string;
  status: SwapStatus;
  createdAt: string;
  updatedAt: string;
}

export type CourseStatus = "draft" | "pending" | "approved" | "rejected" | "suspended";

export interface Course {
  id: string;
  creatorId: string;
  creatorName: string;
  title: string;
  description: string;
  category: string;
  level: "beginner" | "intermediate" | "advanced";
  thumbnailUrl: string;
  mediaUrl: string;
  mediaType: "video" | "pdf" | "image" | "link" | "none";
  price: number;
  status: CourseStatus;
  enrollmentCount: number;
  rewardedThresholds?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Review {
  id: string;
  courseId: string;
  userId: string;
  userName: string;
  rating: number;
  text: string;
  createdAt: string;
}

export interface Enrollment {
  id: string;
  courseId: string;
  userId: string;
  pricePaid: number;
  createdAt: string;
}

export interface CoinTransaction {
  id: string;
  userId: string;
  amount: number;
  reason: string;
  balanceAfter: number;
  courseId?: string;
  adminId?: string;
  createdAt: string;
}

export interface Streak {
  current: number;
  longest: number;
  lastClaimDay: string | null;
  lastClaimAt: string | null;
  history: string[];
}

export interface Conversation {
  id: string;
  participants: string[];
  participantNames: Record<string, string>;
  lastMessage: string;
  lastMessageAt: string;
  unread: Record<string, number>;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link: string;
  read: boolean;
  createdAt: string;
}

export interface Report {
  id: string;
  reporterId: string;
  reporterName: string;
  targetType: "course" | "skill" | "user" | "message";
  targetId: string;
  reason: string;
  status: "open" | "resolved" | "dismissed";
  createdAt: string;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  detail: string;
  createdAt: string;
}

export interface GithubSettings {
  token: string;
  owner: string;
  repo: string;
  prefix: string;
  maxAssets: number;
  uploadUrl: string;
}
