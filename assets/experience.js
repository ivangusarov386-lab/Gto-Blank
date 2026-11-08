// Progressive enhancement: all content and editor actions work without WebGL.
const workTab = document.getElementById("tabWork");
function syncViewHeading() {
  const isEditor = document.body.classList.contains("editor-mode");
  const current = document.getElementById("workspace-title");
  if (current && current.tagName !== (isEditor ? "H1" : "H2")) {
    const next = document.createElement(isEditor ? "h1" : "h2");
    next.id = current.id;
    next.tabIndex = -1;
    next.textContent = current.textContent;
    current.replaceWith(next);
  }
  const calibration = document.body.classList.contains("admin-mode");
  document.title = isEditor
    ? calibration
      ? "Калибровка принтера — ГТО"
      : "Редактор удостоверений — ГТО"
    : "Сервис печати удостоверений ГТО";
  document.querySelector(".skip-link").href = isEditor
    ? "#workspace-title"
    : "#hero-title";
}
syncViewHeading();
for (const id of ["tabWork", "tabAdmin"])
  document.getElementById(id).addEventListener("click", syncViewHeading);
for (const link of document.querySelectorAll("[data-open-workspace]")) {
  link.addEventListener("click", () => {
    workTab.click();
    document.body.classList.add("editor-mode");
    generation++;
    dispose?.();
    dispose = null;
    syncViewHeading();
    history.replaceState(
      null,
      "",
      `${location.pathname}?editor=1${link.getAttribute("href")}`,
    );
    const target = document.querySelector(link.getAttribute("href"));
    requestAnimationFrame(() => {
      target?.focus({ preventScroll: true });
    });
  });
}
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const desktop = matchMedia("(min-width: 801px)");
const host = document.getElementById("hero-canvas");
let dispose = null,
  generation = 0;
async function updateScene() {
  const current = ++generation;
  dispose?.();
  dispose = null;
  if (
    document.body.classList.contains("editor-mode") ||
    !desktop.matches ||
    motion.matches ||
    navigator.connection?.saveData
  )
    return;
  try {
    const { mountScene } = await import("./hero-3d.js?v=9d042f66d727");
    if (current === generation && host.getBoundingClientRect().width > 0)
      dispose = mountScene(host);
  } catch {
    /* The static product illustration remains visible. */
  }
}
const lazy = new IntersectionObserver((entries) => {
  if (!entries[0].isIntersecting) return;
  lazy.disconnect();
  if ("requestIdleCallback" in window)
    requestIdleCallback(updateScene, { timeout: 1500 });
  else setTimeout(updateScene, 200);
});
lazy.observe(host);
motion.addEventListener("change", updateScene);
desktop.addEventListener("change", updateScene);
window.addEventListener("pagehide", () => {
  generation++;
  dispose?.();
  dispose = null;
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) updateScene();
});
