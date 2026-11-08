const defaults = {
  number: { label: "Номер", x: 116, y: 26, size: 10 },
  surname: { label: "Фамилия", x: 79, y: 35, size: 11 },
  first: { label: "Имя", x: 79, y: 40.2, size: 11 },
  middle: { label: "Отчество", x: 79, y: 45.4, size: 11 },
  level: { label: "Ступень", x: 92, y: 64, size: 10 },
  orderDate: { label: "Дата приказа", x: 91, y: 73.4, size: 9 },
  orderNumber: { label: "Номер приказа", x: 119, y: 73.4, size: 9 },
  issued: { label: "Дата выдачи", x: 108, y: 87, size: 9 },
};
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
let saved;
try {
  saved = JSON.parse(readSetting("gto-print-config"));
} catch {}
let cfg = structuredClone(defaults);
const storedFields = saved?.fields || saved;
for (const key of Object.keys(defaults)) {
  for (const prop of ["x", "y", "size"]) {
    const value = storedFields?.[key]?.[prop];
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      (prop !== "size" || value > 0)
    )
      cfg[key][prop] = value;
  }
}
let people = [],
  selected = 0;
let offset = { dx: 0, dy: 0 };
for (const key of ["dx", "dy"]) {
  const value = saved?.offset?.[key];
  if (typeof value === "number" && Number.isFinite(value)) offset[key] = value;
}
const save = () =>
  writeSetting("gto-print-config", JSON.stringify({ fields: cfg, offset }));
function sample() {
  people = [
    {
      number: "АР103731",
      surname: "Абакумова",
      first: "Елизавета",
      middle: "Сергеевна",
      level: "V",
      orderDate: "16.07.2025",
      orderNumber: "153 НГ",
      issued: "24.06.2026",
    },
    {
      number: "АР102413",
      surname: "Саврыкин",
      first: "Семён",
      middle: "Михайлович",
      level: "VI",
      orderDate: "16.07.2025",
      orderNumber: "153 НГ",
      issued: "24.06.2026",
    },
    {
      number: "АР117454",
      surname: "СКОРНЯКОВ",
      first: "Дмитрий",
      middle: "АЛЕКСАНДРОВИЧ",
      level: "VI",
      orderDate: "16.07.2025",
      orderNumber: "153 НГ",
      issued: "24.06.2026",
    },
  ];
  selected = 0;
  render();
}
const fields = {
  number: "Номер удостоверения",
  surname: "Фамилия",
  first: "Имя",
  middle: "Отчество",
  level: "Ступень",
  orderDate: "Дата приказа",
  orderNumber: "Номер приказа",
  issued: "Дата выдачи",
};
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
            `<button type="button" class="name ${i === selected ? "active" : ""}" data-index="${i}" aria-pressed="${i === selected}"><span class="name-avatar" aria-hidden="true">${esc((p.surname || "?")[0])}</span><span><strong>${esc([p.surname, p.first, p.middle].filter(Boolean).join(" ") || "Без имени")}</strong><small>Удостоверение ${esc(p.number || "без номера")}</small></span>${i === selected ? '<span class="selected-mark" aria-hidden="true">✓</span>' : ""}</button>`,
        )
        .join("")
    : '<p class="empty-state">Никого не нашли. Попробуйте другую фамилию или номер.</p>';
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
    `Найдено: ${matches.length} из ${people.length} · Выбрана запись ${selected + 1}`;
  $("printOne").disabled = !people[selected];
  $("printAll").disabled = !people.length;
  $("printAll").textContent = `Напечатать все (${people.length})`;
}
function render() {
  renderNames();
  const p = people[selected] || {};
  $("form").innerHTML = Object.entries(fields)
    .map(
      ([k, l]) =>
        `<div><label for="field-${k}">${l}</label><input id="field-${k}" data-field="${k}" value="${esc(p[k])}" autocomplete="off"></div>`,
    )
    .join("");
  $("form")
    .querySelectorAll("input")
    .forEach(
      (el) =>
        (el.oninput = () => {
          if (!people[selected]) return;
          people[selected][el.dataset.field] = el.value;
          renderNames();
          draw();
        }),
    );
  draw();
}
function markup(p, print = false) {
  return Object.keys(defaults)
    .map((k) => {
      const f = cfg[k],
        x = Number(f.x) + offset.dx,
        y = Number(f.y) + offset.dy;
      return `<div class="field" style="left:${x}mm;top:${y}mm;font-size:${Number(f.size)}pt">${esc(p[k])}</div>`;
    })
    .join("");
}
function draw() {
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
    page.insertAdjacentHTML("beforeend", markup(people[selected] || {}));
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
        cfg[input.dataset.key][input.dataset.prop] = n;
        save();
        draw();
      }),
  );
}
$("guides").onchange = (e) =>
  $("page").classList.toggle("guides", e.target.checked);
$("reset").onclick = () => {
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
  $("search").value = "";
  sample();
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
function val(row, names) {
  const keys = Object.keys(row);
  for (const wanted of names) {
    const found = keys.find((k) =>
      String(k).trim().toLowerCase().includes(wanted),
    );
    if (found !== undefined && row[found] !== undefined)
      return String(row[found]).trim();
  }
  return "";
}
function dateParts(row, prefix) {
  const day = val(row, [prefix + " день", prefix + " дн", prefix + " day"]),
    month = val(row, [prefix + " месяц", prefix + " мес", prefix + " month"]),
    year = val(row, [prefix + " год", prefix + " year"]);
  if (!day && !month && !year)
    return val(row, [prefix + " дата", "дата " + prefix]);
  return [day, month, year]
    .filter(Boolean)
    .map((x, i) => (i < 2 ? x.padStart(2, "0") : x))
    .join(".");
}
function parseRows(rows) {
  const result = rows
    .map((r) => ({
      number: val(r, ["номер удостоверения", "удостоверен", "certificate"]),
      surname: val(r, ["фамилия", "surname"]),
      first: val(r, ["имя", "first"]),
      middle: val(r, ["отчество", "middle"]),
      level: val(r, ["ступень", "level"]),
      orderDate: dateParts(r, "приказ"),
      orderNumber: val(r, ["номер приказ", "приказ номер", "order number"]),
      issued: dateParts(r, "выдача"),
    }))
    .filter((p) => p.surname || p.number);
  if (!result.length)
    throw Error(
      "Не распознаны столбцы с данными. Проверьте заголовки таблицы.",
    );
  people = result;
  selected = 0;
  $("search").value = "";
  render();
}
function parseDelimited(text) {
  text = text.replace(/^\ufeff/, "");
  if (!text.trim())
    throw Error("Файл пуст. Добавьте заголовки и хотя бы одного участника.");
  // Count separators outside quoted fields in the first record.
  let quoted = false,
    semicolons = 0,
    commas = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') i++;
      else quoted = !quoted;
    } else if (!quoted) {
      if (c === "\n" || c === "\r") break;
      if (c === ";") semicolons++;
      if (c === ",") commas++;
    }
  }
  const sep = semicolons >= commas ? ";" : ",";
  let records = [],
    row = [],
    cell = "";
  quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === sep && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      row.push(cell);
      if (row.some((v) => v.trim())) records.push(row);
      row = [];
      cell = "";
      if (c === "\r" && text[i + 1] === "\n") i++;
    } else cell += c;
  }
  if (quoted)
    throw Error(
      "В CSV не закрыты кавычки. Проверьте файл и повторите загрузку.",
    );
  row.push(cell);
  if (row.some((v) => v.trim())) records.push(row);
  const head = records.shift();
  if (!head || !records.length)
    throw Error("В таблице нет участников. Добавьте строки под заголовками.");
  return records.map((values) =>
    Object.fromEntries(head.map((key, i) => [key.trim(), values[i] || ""])),
  );
}
function loadXlsx() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve();
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";
    s.onload = resolve;
    s.onerror = () =>
      reject(
        Error(
          "Не удалось загрузить библиотеку Excel. Сохраните файл как CSV и повторите.",
        ),
      );
    document.head.append(s);
  });
}
$("file").onchange = async (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!/\.(csv|xlsx|xls)$/i.test(file.name)) {
    notify("Выберите таблицу в формате CSV, XLSX или XLS.", true);
    e.target.value = "";
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    notify("Файл слишком большой. Максимальный размер — 10 МБ.", true);
    e.target.value = "";
    return;
  }
  $("file").disabled = true;
  notify(`Загружаем ${file.name}…`);
  try {
    let rows;
    if (/\.csv$/i.test(file.name)) rows = parseDelimited(await file.text());
    else {
      await loadXlsx();
      const wb = XLSX.read(await file.arrayBuffer(), {
        type: "array",
        cellDates: false,
      });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {
        defval: "",
        raw: false,
      });
    }
    if (
      people.length &&
      !confirm(
        "Заменить текущий список участниками из файла? Несохранённые изменения будут потеряны.",
      )
    ) {
      notify("Загрузка отменена. Текущий список сохранён.");
      return;
    }
    parseRows(rows);
    notify(`Готово: ${file.name}. Загружено участников: ${people.length}.`);
  } catch (err) {
    notify(err.message || "Не удалось прочитать таблицу.", true);
  } finally {
    $("file").disabled = false;
    $("file").value = "";
  }
};
function doPrint(all) {
  if (!people.length) return;
  const arr = all ? people : [people[selected]];
  const root = $("print-root");
  root.innerHTML = arr
    .map((p) => `<section class="print-sheet">${markup(p, true)}</section>`)
    .join("");
  root.style.display = "block";
  window.print();
  setTimeout(() => {
    root.style.display = "none";
  }, 200);
}
$("printOne").onclick = () => doPrint(false);
$("printAll").onclick = () => doPrint(true);
window.onafterprint = () => ($("print-root").style.display = "none");
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
$("profileName").value = readSetting("gto-profile-name") || "Основной принтер";
$("saveProfile").onclick = () => {
  const name = $("profileName").value.trim() || "Основной принтер";
  $("profileName").value = name;
  if (writeSetting("gto-profile-name", name) && save())
    notify(`Профиль «${name}» сохранён в этом браузере.`);
};
for (const id of ["tabWork", "tabAdmin"])
  $(id).addEventListener("click", () => {
    $("tabWork").setAttribute("aria-pressed", String(id === "tabWork"));
    $("tabAdmin").setAttribute("aria-pressed", String(id === "tabAdmin"));
  });
// Scale the on-screen preview only; printed millimetres remain unchanged.
function fitPreviews() {
  document.querySelectorAll(".preview-wrap").forEach((wrap) => {
    if (!wrap.clientWidth) return;
    const page = wrap.querySelector(".page");
    const scale = Math.min(1, (wrap.clientWidth - 32) / page.offsetWidth);
    page.style.transform = `scale(${scale})`;
    wrap.style.height = `${page.offsetHeight * scale + 40}px`;
  });
}
new ResizeObserver(fitPreviews).observe(document.querySelector("main"));
$("tabAdmin").addEventListener("click", fitPreviews);
$("tabWork").addEventListener("click", fitPreviews);
positions();
sample();
fitPreviews();
