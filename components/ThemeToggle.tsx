"use client";

export function ThemeToggle() {
  function toggle() {
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const current = root.getAttribute("data-theme") ?? (prefersDark ? "dark" : "light");
    root.setAttribute("data-theme", current === "dark" ? "light" : "dark");
  }

  return (
    <button className="theme-btn" type="button" onClick={toggle}>
      TEMĂ
    </button>
  );
}
