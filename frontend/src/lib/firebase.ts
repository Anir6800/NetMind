import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { initializeApp } from "firebase/app";

const app = initializeApp({ apiKey: "demo", authDomain: "demo-netmind.firebaseapp.com", projectId: "demo-netmind" });
export const auth = getAuth(app);

if (import.meta.env.DEV) connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });

export const login = (email: string, password: string) => signInWithEmailAndPassword(auth, email, password);
export const register = (email: string, password: string) => createUserWithEmailAndPassword(auth, email, password);
