"use client";

import { useEffect, useState } from "react";

function ermittleAktuellesTheme(): "light" | "dark" {
  const gespeichert = document.documentElement.getAttribute("data-theme");
  if (gespeichert === "light" || gespeichert === "dark") return gespeichert;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    setTheme(ermittleAktuellesTheme());
  }, []);

  function umschalten() {
    const naechstes = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", naechstes);
    localStorage.setItem("theme", naechstes);
    setTheme(naechstes);
  }

  return (
    <button
      type="button"
      className="icon-btn"
      onClick={umschalten}
      aria-label="Dark Mode umschalten"
      title="Dark Mode umschalten"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
