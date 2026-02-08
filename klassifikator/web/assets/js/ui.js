const STORAGE_KEY = "portal-theme";
const DARK_CLASS = "dark-theme";

const getPreferredTheme = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") {
    return saved;
  }
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
};

const applyTheme = (theme) => {
  const isDark = theme === "dark";
  document.body.classList.toggle(DARK_CLASS, isDark);
  const toggle = document.querySelector("[data-theme-toggle]");
  if (toggle) {
    toggle.textContent = isDark ? "Светлая тема" : "Темная тема";
    toggle.setAttribute("aria-pressed", String(isDark));
  }
};

const setTheme = (theme) => {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
};

document.addEventListener("DOMContentLoaded", () => {
  console.log("Current theme class:", document.body.className);
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) {
    document.body.classList.remove(DARK_CLASS);
    setTheme("light");
  } else {
    applyTheme(getPreferredTheme());
  }
  const toggle = document.querySelector("[data-theme-toggle]");
  if (!toggle) return;
  toggle.addEventListener("click", () => {
    const isDark = document.body.classList.contains(DARK_CLASS);
    setTheme(isDark ? "light" : "dark");
  });
});
