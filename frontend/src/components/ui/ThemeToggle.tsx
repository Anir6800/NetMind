import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [light, setLight] = useState(() => localStorage.getItem("netmind-theme") === "light");
  useEffect(() => { document.documentElement.dataset.theme = light ? "light" : "dark"; localStorage.setItem("netmind-theme", light ? "light" : "dark"); }, [light]);
  return <button className="icon-button" onClick={() => setLight(!light)} aria-label={`Switch to ${light ? "dark" : "light"} theme`}>{light ? "◐" : "☼"}</button>;
}
