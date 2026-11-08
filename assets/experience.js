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
  link.addEventListener("click", (event) => {
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
    if (target?.id === "workspace-title") {
      target.toggleAttribute("data-pointer-focus", event.detail > 0);
    }
    requestAnimationFrame(() => {
      target?.focus({ preventScroll: true });
    });
  });
}
document.querySelector(".skip-link").addEventListener("click", () => {
  document
    .getElementById("workspace-title")
    .removeAttribute("data-pointer-focus");
});
const motion = matchMedia("(prefers-reduced-motion: reduce)");
const desktop = matchMedia("(min-width: 801px)");
const host = document.getElementById("hero-canvas");
const sceneControl = document.getElementById("scene-motion");
let scenePaused = false;
let sceneAvailable = false;
function syncSceneControl() {
  sceneControl.hidden =
    !sceneAvailable ||
    !desktop.matches ||
    motion.matches ||
    document.body.classList.contains("editor-mode") ||
    navigator.connection?.saveData;
  sceneControl.setAttribute("aria-pressed", String(!scenePaused));
  sceneControl.textContent = scenePaused ? "Включить 3D" : "Остановить 3D";
}
sceneControl.addEventListener("click", () => {
  scenePaused = !scenePaused;
  updateScene();
});
// An isolated illustration: it never reads or changes participants or printer offsets.
const alignmentToggle = document.getElementById("alignment-toggle");
const alignmentDemo = document.getElementById("alignment-demo");
alignmentDemo.classList.remove("is-aligned");
alignmentToggle.hidden = false;
alignmentToggle.addEventListener("click", () => {
  const aligned = alignmentDemo.classList.toggle("is-aligned");
  alignmentToggle.setAttribute("aria-pressed", String(aligned));
});

let dispose = null,
  generation = 0;
async function updateScene() {
  const current = ++generation;
  dispose?.();
  dispose = null;
  syncSceneControl();
  if (
    scenePaused ||
    document.body.classList.contains("editor-mode") ||
    !desktop.matches ||
    motion.matches ||
    navigator.connection?.saveData
  )
    return;
  try {
    const { mountScene } = await import("./hero-3d.js?v=9d042f66d727");
    if (current === generation && host.getBoundingClientRect().width > 0) {
      dispose = mountScene(host);
      const canvas = host.querySelector("canvas");
      sceneAvailable = Boolean(canvas);
      canvas?.addEventListener(
        "webglcontextlost",
        () => {
          sceneAvailable = false;
          syncSceneControl();
        },
        { once: true },
      );
      syncSceneControl();
    }
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
