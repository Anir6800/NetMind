import { useEffect, useState } from "react";
import { Icon } from "../icons/Icon";

export function ThemeToggle() {
  const [light, setLight] = useState(() => {
    try {
      return localStorage.getItem("netmind-theme") === "light";
    } catch {
      return false;
    }
  });
  useEffect(() => {
    document.documentElement.dataset.theme = light ? "light" : "dark";
    try {
      localStorage.setItem("netmind-theme", light ? "light" : "dark");
    } catch {
      /* preference only */
    }
  }, [light]);
  const label = `Switch to ${light ? "dark" : "light"} theme`;
  return (
    <button className="icon-button" onClick={() => setLight(!light)} aria-label={label} title={label}>
      <Icon name={light ? "dark-mode" : "light-mode"} size={20} />
    </button>
  );
}
