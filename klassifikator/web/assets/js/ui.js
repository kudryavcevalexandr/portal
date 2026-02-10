document.addEventListener("DOMContentLoaded", () => {
  const sendAction = (type, data = {}) => {
    const payload = {
      source: "web-ui",
      type,
      page: window.location.pathname,
      ...data,
    };

    const body = JSON.stringify(payload);
    const url = "/api/v1/actions";

    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      return;
    }

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
  };

  sendAction("page_open");

  document.addEventListener("click", (event) => {
    const target = event.target?.closest("a,button,[data-action]");
    if (!target) return;

    sendAction("ui_click", {
      element: target.tagName?.toLowerCase(),
      text: (target.textContent || "").trim().slice(0, 120),
      href: target.getAttribute?.("href") || null,
      action: target.getAttribute?.("data-action") || null,
    });
  });

  let inputTimer;
  document.addEventListener("input", (event) => {
    const el = event.target;
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) {
      return;
    }

    clearTimeout(inputTimer);
    inputTimer = setTimeout(() => {
      sendAction("ui_input", {
        element: el.tagName.toLowerCase(),
        name: el.name || el.id || null,
      });
    }, 500);
  });

  const toggle = document.querySelector("[data-theme-toggle]");
  if (!toggle) return;

  const applyTheme = (theme) => {
    const isDark = theme === "dark";
    document.body.classList.toggle("dark-theme", isDark);
    document.documentElement.classList.toggle("dark-theme", isDark);
    toggle.textContent = isDark ? "Светлая тема" : "Темная тема";
    localStorage.setItem("portal-theme", theme);
  };

  // Инициализация
  const savedTheme = localStorage.getItem("portal-theme") || "light";
  applyTheme(savedTheme);

  toggle.addEventListener("click", () => {
    const newTheme = document.documentElement.classList.contains("dark-theme") ? "light" : "dark";
    applyTheme(newTheme);
    sendAction("theme_toggle", { theme: newTheme });
  });
});
