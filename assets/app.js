const goldDefaults = {
  number: { label: "Номер", x: 116, y: 26, size: 10 },
  surname: { label: "Фамилия", x: 79, y: 35, size: 11 },
  first: { label: "Имя", x: 79, y: 40.2, size: 11 },
  middle: { label: "Отчество", x: 79, y: 45.4, size: 11 },
  level: { label: "Ступень", x: 92, y: 64, size: 10 },
  orderDate: { label: "Дата приказа", x: 91, y: 73.4, size: 9 },
  orderNumber: { label: "Номер приказа", x: 119, y: 73.4, size: 9 },
  issued: { label: "Дата выдачи", x: 108, y: 87, size: 9 },
};
const PAPER = GTO.paper;
const DEFAULT_AUTHORITY = "Департамент спорта города Москвы";
const blankTypes = {
  gold: { label: "Золотой", award: "ЗОЛОТЫМ" },
  silver: { label: "Серебряный", award: "СЕРЕБРЯНЫМ" },
  bronze: { label: "Бронзовый", award: "БРОНЗОВЫМ" },
};
let blankType = "gold";
let defaults = structuredClone(goldDefaults);
const optionalFields = new Set([
  "middle",
  "authority",
  "signerPosition",
  "signerName",
]);
const templateSetting = (key) =>
  blankType === "gold" ? key : `${key}-${blankType}`;
function defaultFields(type) {
  const result = structuredClone(goldDefaults);
  if (type !== "gold")
    Object.assign(result, {
      number: { ...result.number, y: 22.5 },
      surname: { ...result.surname, y: 32.5 },
      first: { ...result.first, y: 37.8 },
      middle: { ...result.middle, y: 43.1 },
      orderDate: { ...result.orderDate, y: 74 },
      orderNumber: { ...result.orderNumber, y: 74 },
      authority: { label: "Орган власти", x: 78, y: 15, size: 7 },
      signerPosition: { label: "Должность", x: 78, y: 80.2, size: 7 },
      signerName: { label: "ФИО подписанта", x: 114, y: 80.2, size: 7 },
    });
  return result;
}
function fillBlankAuthority() {
  if (blankType === "gold") return;
  for (const person of people) {
    if (
      !String(person.authority || "").trim() ||
      person.authority === "Учебный отдел спорта"
    ) {
      person.authority = DEFAULT_AUTHORITY;
    }
  }
}
function formLabels() {
  return Object.fromEntries(
    Object.keys(defaults).map((k) => [k, GTO.fields[k]]),
  );
}
function syncTemplateReference() {
  for (const page of document.querySelectorAll(".page")) {
    page.dataset.blank = blankType;
    page.querySelector(".otherlabel span:nth-child(2)").textContent =
      `${blankTypes[blankType].award} ЗНАКОМ ОТЛИЧИЯ`;
    page.querySelector(".minister-label").textContent =
      blankType === "gold" ? "Министр спорта" : "(должность)";
    page.querySelector(".minister-name").textContent =
      blankType === "gold" ? "М.В. Дегтярев" : "(Ф.И.О.)";
  }
  for (const radio of document.querySelectorAll('[name="blankType"]'))
    radio.checked = radio.value === blankType;
  $("blank-note").textContent =
    blankType === "gold"
      ? "Золотой бланк. Размер разворота 140 × 95 мм. Ранее сохранённые координаты не масштабировались. Проверьте пробной печатью."
      : `${blankTypes[blankType].label} бланк. Дополнительные поля органа власти, должности и ФИО подписанта заполняются при необходимости. Схема по фотографии: проверьте совмещение пробной печатью.`;
}
const $ = (id) => document.getElementById(id);
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function notify(message, error = false) {
  const box = $("feedback");
  box.textContent = message;
  box.hidden = false;
  box.classList.toggle("error", error);
  box.setAttribute("role", error ? "alert" : "status");
  box.setAttribute("aria-live", error ? "assertive" : "polite");
}
function readSetting(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeSetting(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    notify(
      "Браузер не разрешает сохранение настроек. Они действуют до закрытия страницы.",
      true,
    );
    return false;
  }
}
function loadTemplateConfiguration() {
  defaults = defaultFields(blankType);
  let saved;
  try {
    saved = JSON.parse(readSetting(templateSetting("gto-print-config")));
  } catch {}
  cfg = structuredClone(defaults);
  const storedFields = saved?.fields || saved;
  for (const key of Object.keys(defaults))
    for (const prop of ["x", "y", "size"]) {
      const value = storedFields?.[key]?.[prop];
      if (
        typeof value === "number" &&
        Number.isFinite(value) &&
        (prop !== "size" || (value >= 4 && value <= 72))
      )
        cfg[key][prop] = value;
    }
  offset = { dx: 0, dy: 0 };
  for (const key of ["dx", "dy"]) {
    const value = saved?.offset?.[key];
    if (typeof value === "number" && Number.isFinite(value))
      offset[key] = value;
  }
}
blankType = Object.hasOwn(blankTypes, readSetting("gto-blank-type"))
  ? readSetting("gto-blank-type")
  : "gold";
let cfg, offset;
loadTemplateConfiguration();
let people = [],
  selected = 0;
const save = () => {
  const result = writeSetting(
    templateSetting("gto-print-config"),
    JSON.stringify({ template: blankType, paper: PAPER, fields: cfg, offset }),
  );
  if (workspaceReady) calibrationSaved();
  return result;
};
function sample() {
  people = [
    {
      number: "ДЕМО001",
      surname: "Миронова",
      first: "Полина",
      middle: "Олеговна",
      level: "V",
      orderDate: "12.03.2026",
      orderNumber: "001 ПР",
      issued: "20.03.2026",
      authority: DEFAULT_AUTHORITY,
      signerPosition: "Руководитель",
      signerName: "Примеров И. И.",
    },
    {
      number: "ДЕМО002",
      surname: "Волков",
      first: "Никита",
      middle: "Игоревич",
      level: "VI",
      orderDate: "12.03.2026",
      orderNumber: "001 ПР",
      issued: "20.03.2026",
      authority: DEFAULT_AUTHORITY,
      signerPosition: "Руководитель",
      signerName: "Примеров И. И.",
    },
    {
      number: "ДЕМО003",
      surname: "Зорина",
      first: "Арина",
      middle: "Павловна",
      level: "VI",
      orderDate: "12.03.2026",
      orderNumber: "001 ПР",
      issued: "20.03.2026",
      authority: DEFAULT_AUTHORITY,
      signerPosition: "Руководитель",
      signerName: "Примеров И. И.",
    },
  ];
  selected = 0;
  render();
}
let fields = formLabels();
function renderNames() {
  const q = $("search").value.trim().toLocaleLowerCase("ru");
  const matches = people
    .map((p, i) => ({ p, i }))
    .filter(({ p }) =>
      Object.values(p).join(" ").toLocaleLowerCase("ru").includes(q),
    );
  $("names").innerHTML = matches.length
    ? matches
        .map(
          ({ p, i }) =>
            `<button type="button" class="name ${i === selected ? "active" : ""}" data-index="${i}" aria-pressed="${i === selected}"><span class="name-avatar" aria-hidden="true">${esc((p.surname || "?")[0])}</span><span><strong>${esc([p.surname, p.first, p.middle].filter(Boolean).join(" ") || "Без имени")}</strong><small>${p._row ? `Строка ${p._row} · ` : ""}Удостоверение ${esc(p.number || "без номера")}${workspaceReady && issuesByPerson[i]?.length ? " · Нужна проверка" : ""}</small></span>${i === selected ? '<span class="selected-mark" aria-hidden="true">✓</span>' : ""}</button>`,
        )
        .join("")
    : `<p class="empty-state">${people.length ? "Никого не нашли. Попробуйте другую фамилию или номер." : "Список пуст. Загрузите таблицу участников или откройте пример."}</p>`;
  $("names")
    .querySelectorAll("[data-index]")
    .forEach(
      (el) =>
        (el.onclick = () => {
          selected = Number(el.dataset.index);
          render();
          $("names").querySelector(`[data-index="${selected}"]`)?.focus();
        }),
    );
  $("status").textContent =
    `Найдено: ${matches.length} из ${people.length} · Выбрана запись ${people.length ? selected + 1 : "—"}`;
  $("printOne").disabled = !people[selected];
  $("printAll").disabled = !people.length;
  $("printAll").textContent = `Напечатать все (${people.length})`;
}
function render() {
  if (!workspaceReady) renderNames();
  const p = people[selected] || {};
  $("form").innerHTML = Object.entries(fields)
    .map(
      ([k, l]) =>
        `<div><label for="field-${k}">${l}${optionalFields.has(k) ? "" : " *"}</label><input id="field-${k}" data-field="${k}" value="${esc(p[k])}" autocomplete="off" aria-describedby="error-${k}"${optionalFields.has(k) ? "" : ' aria-required="true"'}><span id="error-${k}" class="field-error"></span></div>`,
    )
    .join("");
  $("form")
    .querySelectorAll("input")
    .forEach((el) => (el.onfocus = () => checkpointPeople()));
  $("form")
    .querySelectorAll("input")
    .forEach(
      (el) =>
        (el.oninput = () => {
          if (!people[selected]) return;
          people[selected][el.dataset.field] = el.value;
          peopleChanged();
          draw();
        }),
    );
  draw();
}
function markup(p, print = false, editable = false) {
  return Object.keys(defaults)
    .map((k) => {
      const f = cfg[k],
        x = Number(f.x) + offset.dx,
        y = Number(f.y) + offset.dy;
      const controls = editable
        ? ` data-key="${k}" tabindex="0" role="button" aria-label="Переместить: ${esc(f.label)}" aria-describedby="drag-help"`
        : "";
      return `<div class="field${editable ? " movable" : ""}"${controls} style="left:${x}mm;top:${y}mm;font-size:${Number(f.size)}pt">${esc(p[k] || (editable ? f.label : ""))}</div>`;
    })
    .join("");
}
function draw() {
  syncTemplateReference();
  $("preview-person").textContent =
    [
      people[selected]?.surname,
      people[selected]?.first,
      people[selected]?.middle,
    ]
      .filter(Boolean)
      .join(" ") || "Выберите участника";
  for (const id of ["page", "pageOperator"]) {
    const page = $(id);
    if (!page) continue;
    page.querySelectorAll(".field").forEach((x) => x.remove());
    page.insertAdjacentHTML(
      "beforeend",
      markup(people[selected] || {}, false, id === "page"),
    );
  }
  if (workspaceReady) {
    updateValidation();
    syncFieldTools();
  }
}
function positions() {
  const root = $("positions");
  root.innerHTML = Object.entries(cfg)
    .map(
      ([k, v]) =>
        `<div class="controls"><span>${esc(v.label)}</span>${["x", "y", "size"].map((t) => `<input aria-label="${t} ${esc(v.label)}" type="number" step="${t === "size" ? 0.5 : 0.2}" data-key="${k}" data-prop="${t}" value="${v[t]}">`).join("")}</div>`,
    )
    .join("");
  root.querySelectorAll("input").forEach(
    (input) =>
      (input.oninput = () => {
        const n = Number(input.value);
        if (!Number.isFinite(n) || (input.dataset.prop === "size" && n <= 0))
          return;
        if (input.dataset.prop === "size" && (n < 4 || n > 72)) return;
        cfg[input.dataset.key][input.dataset.prop] = n;
        save();
        draw();
      }),
  );
}
// Pointer coordinates are screen pixels; the template and saved positions use mm.
const editor = $("page");
let drag = null;
function moveField(key, x, y, element) {
  const pixelsPerMm = parseFloat(getComputedStyle(editor).width) / PAPER.width;
  const maxX = Math.max(0, PAPER.width - element.offsetWidth / pixelsPerMm);
  const maxY = Math.max(0, PAPER.height - element.offsetHeight / pixelsPerMm);
  cfg[key].x =
    Math.round((Math.min(maxX, Math.max(0, x + offset.dx)) - offset.dx) * 10) /
    10;
  cfg[key].y =
    Math.round((Math.min(maxY, Math.max(0, y + offset.dy)) - offset.dy) * 10) /
    10;
  element.style.left = `${cfg[key].x + offset.dx}mm`;
  element.style.top = `${cfg[key].y + offset.dy}mm`;
  for (const prop of ["x", "y"]) {
    $("positions").querySelector(
      `[data-key="${key}"][data-prop="${prop}"]`,
    ).value = cfg[key][prop];
  }
}
let dragAnnounceTimer;
function setDragStatus(message) {
  clearTimeout(dragAnnounceTimer);
  dragAnnounceTimer = setTimeout(() => {
    if (!document.querySelector("dialog[open]"))
      $("drag-status").textContent = message;
  }, 160);
}
function finishMove(key) {
  save();
  draw();
  editor.querySelector(`[data-key="${key}"]`)?.focus({ preventScroll: true });
  setDragStatus(
    `${cfg[key].label}: X ${cfg[key].x} мм, Y ${cfg[key].y} мм. Положение обновлено.`,
  );
}
editor.addEventListener("pointerdown", (event) => {
  const field = event.target.closest(".movable");
  if (!field || !event.isPrimary || event.button !== 0 || drag) return;
  event.preventDefault();
  activeField = field.dataset.key;
  field.focus({ preventScroll: true });
  drag = {
    key: field.dataset.key,
    field,
    id: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    x: cfg[field.dataset.key].x,
    y: cfg[field.dataset.key].y,
    width: editor.getBoundingClientRect().width,
    height: editor.getBoundingClientRect().height,
  };
  field.classList.add("dragging");
  field.setPointerCapture(event.pointerId);
});
editor.addEventListener("pointermove", (event) => {
  if (!drag || event.pointerId !== drag.id) return;
  moveField(
    drag.key,
    drag.x + ((event.clientX - drag.startX) * PAPER.width) / drag.width,
    drag.y + ((event.clientY - drag.startY) * PAPER.height) / drag.height,
    drag.field,
  );
});
function endDrag(event, cancelled = false) {
  if (!drag || (event && event.pointerId !== drag.id)) return;
  const current = drag;
  drag = null;
  if (current.field.hasPointerCapture(current.id))
    current.field.releasePointerCapture(current.id);
  if (cancelled) {
    cfg[current.key].x = current.x;
    cfg[current.key].y = current.y;
    positions();
  }
  finishMove(current.key);
  if (cancelled) setDragStatus("Перемещение отменено.");
}
editor.addEventListener("pointerup", (event) => endDrag(event));
editor.addEventListener("pointercancel", (event) => endDrag(event, true));
editor.addEventListener("lostpointercapture", (event) => endDrag(event, true));
editor.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && drag) {
    event.preventDefault();
    endDrag(null, true);
    return;
  }
  const field = event.target.closest(".movable");
  const directions = {
    ArrowLeft: [-1, 0],
    ArrowRight: [1, 0],
    ArrowUp: [0, -1],
    ArrowDown: [0, 1],
  };
  if (!field || !directions[event.key] || drag) return;
  event.preventDefault();
  const [dx, dy] = directions[event.key],
    step = event.shiftKey ? 1 : 0.2;
  const key = field.dataset.key;
  moveField(key, cfg[key].x + dx * step, cfg[key].y + dy * step, field);
  finishMove(key);
});
$("guides").onchange = (e) =>
  $("page").classList.toggle("guides", e.target.checked);
$("reset").onclick = () => {
  if (
    !confirm(
      "Сбросить положение всех полей и смещение принтера? Действие можно отменить кнопкой «Отменить».",
    )
  )
    return;
  cfg = structuredClone(defaults);
  offset = { dx: 0, dy: 0 };
  $("dx").value = $("dy").value = 0;
  save();
  positions();
  draw();
};
for (const k of ["dx", "dy"])
  $(k).oninput = (e) => {
    offset[k] = Number(e.target.value) || 0;
    save();
    draw();
  };
$("search").oninput = renderNames;
$("demo").onclick = () => {
  if (
    people.length &&
    !confirm(
      "Заменить текущие записи демонстрационным примером? Несохранённые изменения будут потеряны.",
    )
  )
    return;
  checkpointPeople();
  $("search").value = "";
  sample();
  peopleChanged();
  notify("Загружены 3 демонстрационные записи.");
};
function toCSV() {
  const headings = [
    "Номер удостоверения",
    "Фамилия",
    "Имя",
    "Отчество",
    "Ступень",
    "Приказ день",
    "Приказ месяц",
    "Приказ год",
    "Номер приказа",
    "Выдача день",
    "Выдача месяц",
    "Выдача год",
    "Орган исполнительной власти",
    "Должность подписанта",
    "ФИО подписанта",
  ];
  const blob = new Blob(["\ufeff" + headings.join(";") + "\n"], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "gto_template.csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}
$("csv").onclick = toCSV;
// Import, matching and decoding live in workspace.js; parsing rules in data.js.
$("file").onchange = openImport;
function doPrint(all) {
  if (!people.length) return;
  updateValidation();
  if (all) return reviewPrint();
  if (issuesByPerson[selected]?.length) {
    notify(
      "Печать остановлена: исправьте отмеченные поля выбранного участника.",
      true,
    );
    $("validation").focus();
    return;
  }
  performPrint([people[selected]]);
}
function performPrint(arr) {
  const root = $("print-root");
  root.innerHTML = arr
    .map((p) => `<section class="print-sheet">${markup(p, true)}</section>`)
    .join("");
  window.print();
}
$("printOne").onclick = () => doPrint(false);
$("printAll").onclick = () => doPrint(true);
window.onafterprint = () => $("print-root").replaceChildren();
$("tabWork").onclick = () => {
  document.body.classList.remove("admin-mode");
  $("tabWork").classList.add("active");
  $("tabAdmin").classList.remove("active");
};
$("tabAdmin").onclick = () => {
  document.body.classList.add("admin-mode");
  $("tabAdmin").classList.add("active");
  $("tabWork").classList.remove("active");
  draw();
};
$("dx").value = offset.dx;
$("dy").value = offset.dy;
$("profileName").value =
  readSetting(templateSetting("gto-profile-name")) || "Основной принтер";
$("saveProfile").onclick = savePrinterProfile;
for (const id of ["tabWork", "tabAdmin"])
  $(id).addEventListener("click", () => {
    $("tabWork").setAttribute("aria-pressed", String(id === "tabWork"));
    $("tabAdmin").setAttribute("aria-pressed", String(id === "tabAdmin"));
  });
// Scale the on-screen preview only; printed millimetres remain unchanged.
function fitPreviews() {
  // Batch geometry reads before style writes to avoid layout thrashing.
  const layouts = [...document.querySelectorAll(".preview-wrap")]
    .filter((wrap) => wrap.clientWidth)
    .map((wrap) => {
      const page = wrap.querySelector(".page"),
        style = getComputedStyle(page);
      const zoomed = wrap.classList.contains("is-zoomed");
      const scale = zoomed
        ? 1.5
        : Math.min(1, (wrap.clientWidth - 32) / parseFloat(style.width));
      return {
        wrap,
        page,
        scale,
        height: zoomed ? "520px" : `${parseFloat(style.height) * scale + 40}px`,
      };
    });
  for (const { wrap, page, scale, height } of layouts) {
    page.style.transform = `scale(${scale})`;
    wrap.style.height = height;
  }
}
let fitFrame;
new ResizeObserver(() => {
  cancelAnimationFrame(fitFrame);
  fitFrame = requestAnimationFrame(fitPreviews);
}).observe(document.querySelector("main"));
$("tabAdmin").addEventListener("click", fitPreviews);
$("tabWork").addEventListener("click", fitPreviews);
positions();
sample();
initWorkspace();
fitPreviews();
