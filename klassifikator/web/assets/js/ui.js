document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.querySelector("[data-theme-toggle]");
  if (!toggle) return;

  const applyTheme = (theme) => {
    const isDark = theme === "dark";
    document.body.classList.toggle("dark-theme", isDark);
    toggle.textContent = isDark ? "Светлая тема" : "Темная тема";
    localStorage.setItem("portal-theme", theme);
  };

  // Инициализация
  const savedTheme = localStorage.getItem("portal-theme") || "light";
  applyTheme(savedTheme);

  toggle.addEventListener("click", () => {
    const newTheme = document.body.classList.contains("dark-theme") ? "light" : "dark";
    applyTheme(newTheme);
  });
});
