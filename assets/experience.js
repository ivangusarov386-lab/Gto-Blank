// Progressive enhancement: all content and editor actions work without WebGL.
const workTab = document.getElementById("tabWork");
for (const link of document.querySelectorAll("[data-open-workspace]")) {
  link.addEventListener("click", () => {
    workTab.click();
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
  if (!desktop.matches || motion.matches || navigator.connection?.saveData)
    return;
  try {
    const { mountScene } = await import("./hero-3d.js");
    if (current === generation) dispose = mountScene(host);
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
