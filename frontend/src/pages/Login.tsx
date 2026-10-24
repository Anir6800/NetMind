import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { auth, login, register } from "../lib/firebase";

export function Login() {
  const [email, setEmail] = useState("student@netmind.local");
  const [password, setPassword] = useState("NetMindDemo!2026");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  if (auth.currentUser || ready) return <Navigate to="/" replace />;
  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      await (mode === "login"
        ? login(email, password)
        : register(email, password));
      setReady(true);
    } catch {
      setError(
        mode === "login"
          ? "Login failed. Check the email and password."
          : "Account creation failed. Try another email.",
      );
    }
  }
  return (
    <main className="login-page">
      <section className="login-copy">
        <p className="eyebrow">NETMIND · STUDENT NETWORK LAB</p>
        <h1>Build it. Break it. Watch the network adapt.</h1>
        <p>
          Create networks with up to 50 devices, animate packets, inspect
          routing changes, and learn from every simulation.
        </p>
        <div className="login-features">
          <span>Static · RIP · OSPF</span>
          <span>ICMP · ARP · DHCP · DNS · TCP · UDP · HTTP</span>
          <span>Realistic timing · slow-motion replay</span>
        </div>
      </section>
      <section className="login-card">
        <div className="segmented">
          <button
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
            type="button"
          >
            Sign in
          </button>
          <button
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
            type="button"
          >
            Create account
          </button>
        </div>
        <form onSubmit={submit}>
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="primary-button" type="submit">
            {mode === "login" ? "Enter simulator" : "Create student account"}
          </button>
        </form>
        <small>
          Local Firebase emulator account. Nothing is hosted publicly.
        </small>
      </section>
    </main>
  );
}
