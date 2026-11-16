import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

/**
 * Firebase is initialised in two independent steps on purpose:
 * authentication must keep working even if Firestore is unreachable, so no
 * Firestore call happens during initialisation and every data call is wrapped by
 * the service layer instead.
 */
const firebaseConfig = {
  apiKey: "AIzaSyCCySvavVCa_T84ZgFuxwSAbO43r37-4jY",
  authDomain: "skullswap.firebaseapp.com",
  projectId: "skullswap",
  storageBucket: "skullswap.firebasestorage.app",
  messagingSenderId: "454763682802",
  appId: "1:454763682802:web:7c5835d99c83754996296b",
  measurementId: "G-G90SKXCTXR",
};

export const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const ADMIN_EMAILS = ["tanishqlalwani202@gmail.com"];
