import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../../lib/firebase";

export function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const [user, setUser] = useState(auth.currentUser);
  const [role, setRole] = useState<string>();
  const [ready, setReady] = useState(false);
  useEffect(() => onAuthStateChanged(auth, async (nextUser) => { setUser(nextUser); setRole(nextUser ? String((await nextUser.getIdTokenResult()).claims.role ?? "") : ""); setReady(true); }), []);
  if (!ready) return null;
  if (!user) return <Navigate to="/" replace />;
  return roles && (!role || !roles.includes(role)) ? <Navigate to="/" replace /> : <>{children}</>;
}
