(function () {
  const storageKey = "profa-theme";
  const labels = {
    light: "Claro",
    dark: "Escuro",
    system: "Sistema",
  };
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  function getPreference() {
    return localStorage.getItem(storageKey) || "system";
  }

  function resolveTheme(preference) {
    return preference === "system" ? (media.matches ? "dark" : "light") : preference;
  }

  function applyTheme(preference) {
    const resolved = resolveTheme(preference);
    document.documentElement.dataset.theme = resolved;
    document.documentElement.dataset.themePreference = preference;
  }

  function buildControl() {
    if (document.getElementById("theme-control")) {
      return;
    }

    const wrapper = document.createElement("div");
    wrapper.id = "theme-control";
    wrapper.className = "theme-control";
    wrapper.innerHTML = `
      <label class="theme-control-label" for="theme-select">Tema</label>
      <select id="theme-select" class="theme-select" aria-label="Selecionar tema">
        ${Object.entries(labels)
          .map(([value, label]) => `<option value="${value}">${label}</option>`)
          .join("")}
      </select>
    `;
    document.body.appendChild(wrapper);

    const select = wrapper.querySelector("select");
    select.value = getPreference();
    select.addEventListener("change", () => {
      localStorage.setItem(storageKey, select.value);
      applyTheme(select.value);
    });
  }

  applyTheme(getPreference());

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", buildControl);
  } else {
    buildControl();
  }

  media.addEventListener("change", () => {
    if (getPreference() === "system") {
      applyTheme("system");
    }
  });
})();
