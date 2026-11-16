import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { auth, ADMIN_EMAILS } from "../lib/firebase";
import { createProfile, getProfile, touchLogin } from "../lib/api";
import type { UserProfile } from "../lib/types";

interface AuthState {
  user: UserProfile | null;
  firebaseUid: string | null;
  loading: boolean;
  dataError: string | null;
  isAdmin: boolean;
  isDemo: boolean;
  signUp: (input: {
    email: string;
    password: string;
    username: string;
    displayName: string;
  }) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOutNow: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  startDemo: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

/** Turns Firestore/auth failures into something a human can act on. */
export function friendlyDataError(error: any): string {
  const code = String(error?.code || "");
  if (code.includes("permission-denied") || /insufficient permissions/i.test(error?.message || "")) {
    return "The database rejected this write (permission denied). Deploy the Firestore rules with: firebase deploy --only firestore:rules";
  }
  if (code.includes("unavailable") || /offline/i.test(error?.message || "")) {
    return "We could not reach the database. Your session is still active — retry when you are back online.";
  }
  if (code.includes("failed-precondition")) {
    return "The database needs an index for this query. Deploy firestore.indexes.json (firebase deploy --only firestore:indexes).";
  }
  return error?.message || "Something went wrong talking to the database.";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [firebaseUid, setFirebaseUid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  /**
   * Authentication and profile loading are deliberately separate. If Firestore is
   * unreachable we still finish the auth handshake and surface a recoverable data
   * error instead of leaving the login screen stuck.
   */
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUid(fbUser ? fbUser.uid : null);
      if (!fbUser) {
        setUser(null);
        setLoading(false);
        return;
      }
      try {
        const profile = await getProfile(fbUser.uid);
        if (profile) {
          setUser(profile);
          setDataError(null);
          touchLogin(fbUser.uid).catch(() => {});
        } else {
          // Signed in but the profile is missing (e.g. interrupted signup).
          const fallback: UserProfile = {
            id: fbUser.uid,
            email: fbUser.email || "",
            username: (fbUser.email || "member").split("@")[0].toLowerCase(),
            displayName: fbUser.displayName || "Member",
            interests: [],
            skillsWanted: [],
            role: ADMIN_EMAILS.includes((fbUser.email || "").toLowerCase()) ? "admin" : "user",
            status: "active",
            balance: 0,
            demo: Boolean(fbUser.isAnonymous),
          };
          try {
            await createProfile(fallback);
            setUser(fallback);
          } catch (error: any) {
            setUser(fallback);
            setDataError(friendlyDataError(error));
          }
        }
      } catch (error: any) {
        setDataError(friendlyDataError(error));
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      firebaseUid,
      loading,
      dataError,
      isAdmin: user?.role === "admin",
      isDemo: Boolean(user?.demo),
      async signUp({ email, password, username, displayName }) {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        const cleanEmail = email.trim().toLowerCase();
        const profile: UserProfile = {
          id: cred.user.uid,
          email: cleanEmail,
          username: username.toLowerCase().replace(/[^a-z0-9_]/g, ""),
          displayName,
          interests: [],
          skillsWanted: [],
          role: ADMIN_EMAILS.includes(cleanEmail) ? "admin" : "user",
          status: "active",
          balance: 10,
          demo: false,
        };
        try {
          await updateProfile(cred.user, { displayName });
          await createProfile(profile);
          setUser(profile);
        } catch (error: any) {
          // Do not leave a signed-in account with no profile behind: roll the
          // auth user back so the address can be used again once rules are fixed.
          try {
            await deleteUser(cred.user);
          } catch {
            /* best effort */
          }
          throw new Error(friendlyDataError(error));
        }
      },
      async signIn(email, password) {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      },
      async signOutNow() {
        await signOut(auth);
        setUser(null);
      },
      async resetPassword(email) {
        await sendPasswordResetEmail(auth, email.trim());
      },
      async startDemo() {
        const cred = await signInAnonymously(auth);
        const profile: UserProfile = {
          id: cred.user.uid,
          email: "demo@skillswap.local",
          username: `demo${cred.user.uid.slice(0, 4)}`,
          displayName: "Demo Visitor",
          interests: [],
          skillsWanted: [],
          role: "user",
          status: "active",
          balance: 0,
          demo: true,
        };
        try {
          await createProfile(profile);
        } catch (error: any) {
          setDataError(friendlyDataError(error));
        }
        setUser(profile);
      },
      async refreshProfile() {
        if (!auth.currentUser) return;
        const profile = await getProfile(auth.currentUser.uid);
        if (profile) setUser(profile);
      },
    }),
    [user, firebaseUid, loading, dataError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
