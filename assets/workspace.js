// UI extensions for the existing static editor. Personal data is persisted only by opt-in.
let workspaceReady = false,
  issuesByPerson = [],
  activeField = "surname";
let peopleDirty = false,
  peoplePast = [],
  lastPeopleCheckpoint = "",
  draftTimer;
let calibrationPast = [],
  calibrationFuture = [],
  restoringCalibration = false;
let printers = {},
  activePrinter = "",
  pendingImport = null,
  importCandidate = null,
  pendingPrint = [];
const clone = (value) => structuredClone(value);
const jsonRead = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
};
const removeSetting = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {}
};
const configuration = () => ({ fields: clone(cfg), offset: clone(offset) });
function downloadFile(name, body, type) {
  const url = URL.createObjectURL(new Blob([body], { type })),
    link = document.createElement("a");
  link.href = url;
  link.download = name;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function checkpointPeople() {
  if (!workspaceReady) return;
  const value = JSON.stringify(people);
  if (value !== lastPeopleCheckpoint) {
    peoplePast.push(value);
    if (peoplePast.length > 10) peoplePast.shift();
    lastPeopleCheckpoint = value;
  }
  $("undoPeople").disabled = !peoplePast.length;
}
function persistDraft() {
  clearTimeout(draftTimer);
  if (!$("keepDraft").checked) {
    removeSetting("gto-participant-draft");
    return;
  }
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  if (
    !writeSetting(
      "gto-participant-draft",
      JSON.stringify({ version: 1, expiresAt, people }),
    )
  ) {
    $("keepDraft").checked = false;
    return;
  }
  draftTimer = setTimeout(
    () => {
      removeSetting("gto-participant-draft");
      $("keepDraft").checked = false;
      updateDataState();
    },
    24 * 60 * 60 * 1000,
  );
}
function updateDataState() {
  $("data-state").textContent = $("keepDraft").checked
    ? "Локальный черновик включён. Восстановление доступно 24 часа. Можно удалить его кнопкой ниже."
    : peopleDirty
      ? "Есть изменения без экспорта. Скачайте заполненный CSV перед закрытием."
      : "Скачайте CSV, чтобы сохранить участников. Автоматическое хранение выключено.";
  $("exportPeople").disabled = !people.length;
  $("undoPeople").disabled = !peoplePast.length;
}
function peopleChanged() {
  if (!workspaceReady) return;
  peopleDirty = true;
  persistDraft();
  updateDataState();
}
const measureContext = document.createElement("canvas").getContext("2d");
function overflowIssues(p) {
  const issues = [];
  for (const k of Object.keys(defaults)) {
    const text = String(p[k] || "").replace(/\s+/g, " "),
      f = cfg[k];
    if (!text) continue;
    measureContext.font = `700 ${f.size}pt "Times New Roman"`;
    const width = (measureContext.measureText(text).width * 25.4) / 96,
      height = (f.size * 25.4) / 72;
    if (
      f.x + offset.dx < 0 ||
      f.y + offset.dy < 0 ||
      f.x + offset.dx + width > PAPER.width + 0.02 ||
      f.y + offset.dy + height > PAPER.height + 0.02
    )
      issues.push({
        key: k,
        message: `${GTO.fields[k]}: текст выходит за бланк`,
        overflow: true,
      });
  }
  return issues;
}
function updateValidation() {
  const duplicate = GTO.duplicateNumbers(people);
  issuesByPerson = people.map((p) => [
    ...GTO.validate(p, duplicate),
    ...overflowIssues(p),
  ]);
  const ready = issuesByPerson.filter((a) => !a.length).length;
  $("validation").innerHTML =
    `<strong>Готово к печати: ${ready} из ${people.length}</strong><p>${ready === people.length && people.length ? "Все записи проверены. Перед тиражом сделайте пробную печать." : "Проверьте обязательные поля, даты, дубликаты и выход текста за края."}</p>`;
  const selectedIssues = issuesByPerson[selected] || [];
  for (const k of Object.keys(defaults)) {
    const input = $("field-" + k),
      message = $("error-" + k);
    if (!input) continue;
    const problem = selectedIssues
      .filter((e) => e.key === k)
      .map((e) => e.message)
      .join(". ");
    input.setAttribute("aria-invalid", String(!!problem));
    message.textContent = problem;
  }
  for (const pageId of ["page", "pageOperator"]) {
    const nodes = $(pageId).querySelectorAll(".field");
    Object.keys(defaults).forEach((k, i) => {
      nodes[i]?.classList.toggle(
        "overflow-field",
        selectedIssues.some((e) => e.key === k && e.overflow),
      );
    });
  }
  renderNames();
}
function reviewPrint() {
  pendingPrint = people.filter((p, i) => !issuesByPerson[i].length);
  const bad = issuesByPerson
    .map((errors, i) => ({ errors, i }))
    .filter((r) => r.errors.length);
  $("print-review-body").innerHTML =
    `<p>Готово: <b>${pendingPrint.length}</b>. Требуют проверки: <b>${bad.length}</b>.</p>${
      bad.length
        ? "<p>Записи с ошибками не будут напечатаны. Можно вернуться и исправить их либо явно напечатать только готовые.</p><ul tabindex='0' aria-label='Записи с ошибками'>" +
          bad
            .slice(0, 50)
            .map(
              ({ errors, i }) =>
                `<li>Запись ${i + 1}: ${esc(people[i].surname || people[i].number || "Без имени")} — ${esc(errors.map((e) => e.message).join("; "))}</li>`,
            )
            .join("") +
          "</ul>" +
          (bad.length > 50
            ? "<p>Показаны первые 50 записей с ошибками.</p>"
            : "")
        : "<p>В тираж включены все участники.</p>"
    }`;
  $("confirmPrint").disabled = !pendingPrint.length;
  $("confirmPrint").textContent = bad.length
    ? `Напечатать только готовые (${pendingPrint.length})`
    : `Напечатать ${pendingPrint.length}`;
  $("print-review").showModal();
}
function calibrationSaved() {
  const value = JSON.stringify(configuration());
  if (!restoringCalibration && calibrationPast.at(-1) !== value) {
    calibrationPast.push(value);
    if (calibrationPast.length > 60) calibrationPast.shift();
    calibrationFuture = [];
  }
  $("undoCalibration").disabled = calibrationPast.length < 2;
  $("redoCalibration").disabled = !calibrationFuture.length;
  const stored = printers[activePrinter];
  $("profile-state").textContent =
    stored &&
    JSON.stringify({ fields: stored.fields, offset: stored.offset }) === value
      ? "Калибровка совпадает с сохранённым профилем."
      : "Есть изменения калибровки. Сохраните профиль или скачайте резервную копию.";
}
function applyConfiguration(value) {
  cfg = clone(value.fields);
  offset = clone(value.offset);
  $("dx").value = offset.dx;
  $("dy").value = offset.dy;
  positions();
  save();
  draw();
}
function validConfiguration(value) {
  if (value?.template && value.template !== blankType)
    throw Error("Калибровка предназначена для другого типа бланка.");
  if (!value || typeof value !== "object" || !value.fields || !value.offset)
    throw Error("В файле нет калибровки fields/offset.");
  const result = { fields: clone(defaults), offset: {} };
  for (const k of Object.keys(defaults))
    for (const prop of ["x", "y", "size"]) {
      const n = value.fields[k]?.[prop];
      if (
        typeof n !== "number" ||
        !Number.isFinite(n) ||
        Math.abs(n) > 1000 ||
        (prop === "size" && (n < 4 || n > 72))
      )
        throw Error(`Некорректная калибровка: ${GTO.fields[k]}, ${prop}`);
      result.fields[k][prop] = n;
    }
  for (const k of ["dx", "dy"]) {
    const n = value.offset[k];
    if (typeof n !== "number" || !Number.isFinite(n) || Math.abs(n) > 1000)
      throw Error("Некорректное смещение принтера.");
    result.offset[k] = n;
  }
  return result;
}
function persistProfiles() {
  return writeSetting(
    templateSetting("gto-printer-profiles"),
    JSON.stringify({
      version: 1,
      template: blankType,
      activeId: activePrinter,
      profiles: printers,
    }),
  );
}
function profileOptions() {
  $("profileSelect").innerHTML = Object.entries(printers)
    .map(([id, p]) => `<option value="${esc(id)}">${esc(p.name)}</option>`)
    .join("");
  $("profileSelect").value = activePrinter;
  $("deleteProfile").disabled = Object.keys(printers).length < 2;
}
function savePrinterProfile() {
  const name = $("profileName").value.trim().slice(0, 80) || "Основной принтер";
  const existing = Object.keys(printers).find(
    (id) => printers[id].name === name,
  );
  if (
    existing &&
    existing !== activePrinter &&
    !confirm(`Заменить сохранённый профиль «${name}»?`)
  )
    return;
  if (!existing && Object.keys(printers).length >= 50) {
    notify(
      "Можно хранить не больше 50 профилей. Удалите ненужный профиль.",
      true,
    );
    return;
  }
  const id = existing || crypto.randomUUID();
  printers[id] = { name, ...configuration() };
  activePrinter = id;
  $("profileName").value = name;
  const saved = persistProfiles();
  const named = writeSetting(templateSetting("gto-profile-name"), name);
  const calibrated = save();
  profileOptions();
  if (saved && named && calibrated)
    notify(`Профиль «${name}» сохранён в этом браузере.`);
}
function syncFieldTools() {
  if (!workspaceReady) return;
  $("fieldSelect").value = activeField;
  $("selectedFont").value = cfg[activeField].size;
  $("page")
    .querySelectorAll(".movable")
    .forEach((el) =>
      el.classList.toggle("selected-field", el.dataset.key === activeField),
    );
}
function nudge(dx, dy) {
  const el = $("page").querySelector(`[data-key="${activeField}"]`);
  if (!el) return;
  const step = Number($("nudgeStep").value);
  moveField(
    activeField,
    cfg[activeField].x + dx * step,
    cfg[activeField].y + dy * step,
    el,
  );
  finishMove(activeField);
}
function fitSelectedField() {
  const text = String(people[selected]?.[activeField] || "").replace(
    /\s+/g,
    " ",
  );
  if (!text) return;
  const f = cfg[activeField],
    available = PAPER.width - (f.x + offset.dx);
  if (available <= 0 || f.x + offset.dx < 0) {
    notify("Сначала переместите начало поля внутрь бланка.", true);
    return;
  }
  measureContext.font = `700 ${f.size}pt "Times New Roman"`;
  const width = (measureContext.measureText(text).width * 25.4) / 96;
  const next = Math.min(
    f.size,
    Math.floor(((f.size * available) / Math.max(width, 0.01)) * 2) / 2,
  );
  if (next < 6) {
    notify(
      "Текст нельзя уместить при читаемом размере 6 пт. Проверьте запись или переместите поле.",
      true,
    );
    return;
  }
  f.size = next;
  save();
  positions();
  draw();
}
let excelPromise;
function loadXlsx() {
  if (!excelPromise)
    excelPromise = import(
      new URL($("excel-module").dataset.src, document.baseURI).href
    ).catch((err) => {
      excelPromise = null;
      throw Error(
        "Не удалось загрузить локальный модуль Excel. Перезагрузите страницу или используйте CSV.",
      );
    });
  return excelPromise;
}
function decodeCSV(buffer, encoding) {
  if (encoding !== "auto")
    return new TextDecoder(encoding, { fatal: true }).decode(buffer);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1251").decode(buffer);
  }
}
async function openImport(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (!/\.(csv|xlsx|xls)$/i.test(file.name))
      throw Error("Выберите CSV, XLSX или XLS.");
    if (file.size > 10 * 1024 * 1024)
      throw Error("Файл слишком большой. Максимальный размер — 10 МБ.");
    $("file").disabled = true;
    $("import-loading").hidden = false;
    $("feedback").hidden = true;
    pendingImport = {
      name: file.name,
      buffer: await file.arrayBuffer(),
      csv: /\.csv$/i.test(file.name),
    };
    $("importEncoding").value = "auto";
    $("encoding-control").hidden = !pendingImport.csv;
    $("sheet-control").hidden = pendingImport.csv;
    if (!pendingImport.csv) {
      const XLSX = await loadXlsx();
      pendingImport.XLSX = XLSX;
      pendingImport.book = XLSX.read(pendingImport.buffer, {
        type: "array",
        cellDates: true,
      });
      if (!pendingImport.book.SheetNames.length)
        throw Error("В книге Excel нет листов.");
      $("importSheet").innerHTML = pendingImport.book.SheetNames.map(
        (name, i) => `<option value="${i}">${esc(name)}</option>`,
      ).join("");
    }
    rebuildImport();
    $("import-file").textContent = file.name;
    $("import-dialog").showModal();
    notify(
      "Предпросмотр импорта готов. Проверьте столбцы и подтвердите замену списка.",
    );
  } catch (err) {
    pendingImport = null;
    notify(err.message || "Не удалось прочитать файл.", true);
  } finally {
    $("file").disabled = false;
    $("import-loading").hidden = true;
    $("file").value = "";
  }
}
function rebuildImport() {
  try {
    const source = pendingImport;
    if (!source) return;
    let table;
    if (source.csv)
      table = GTO.parseCSV(decodeCSV(source.buffer, $("importEncoding").value));
    else {
      const sheet =
        source.book.Sheets[
          source.book.SheetNames[Number($("importSheet").value) || 0]
        ];
      const sourceRange = source.XLSX.utils.decode_range(sheet["!ref"] || "A1");
      if (
        sourceRange.e.r - sourceRange.s.r > 10000 ||
        sourceRange.e.c - sourceRange.s.c >= 200
      )
        throw Error("Лист больше допустимых 10 000 строк или 200 столбцов.");
      const rows = source.XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
        blankrows: true,
      });
      const range = source.XLSX.utils.decode_range(sheet["!ref"] || "A1");
      for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
          const cell = sheet[source.XLSX.utils.encode_cell({ r, c })];
          if (
            cell?.t === "d" &&
            cell.v instanceof Date &&
            rows[r - range.s.r]
          ) {
            const date = cell.v;
            rows[r - range.s.r][c - range.s.c] = [
              String(date.getUTCDate()).padStart(2, "0"),
              String(date.getUTCMonth() + 1).padStart(2, "0"),
              String(date.getUTCFullYear()),
            ].join(".");
          }
        }
      }
      const headers = (rows.shift() || []).map(String);
      if (
        !headers.some(Boolean) ||
        !rows.some((row) => row.some((v) => String(v).trim()))
      )
        throw Error("В таблице нет участников.");
      if (rows.length > 10000) throw Error("В файле больше 10 000 строк.");
      table = { headers, rows, rowOffset: range.s.r };
    }
    if (table.headers.length > 200)
      throw Error(
        "В таблице больше 200 столбцов. Оставьте только нужные данные.",
      );
    source.table = table;
    const mapping = GTO.suggest(table.headers);
    $("columnMapping").innerHTML = Object.entries({
      ...GTO.fields,
      ...GTO.parts,
    })
      .map(
        ([key, label]) =>
          `<div><label for="map-${key}">${label}</label><select id="map-${key}" data-map="${key}"><option value="-1">Не выбран</option>${table.headers.map((h, i) => `<option value="${i}"${mapping[key] === i ? " selected" : ""}>${esc(h || "Столбец " + (i + 1))}</option>`).join("")}</select></div>`,
      )
      .join("");
    document.querySelector(".mapping-details").open = [
      "number",
      "surname",
      "first",
      "level",
      "orderNumber",
    ].some((key) => mapping[key] < 0);
    $("columnMapping")
      .querySelectorAll("select")
      .forEach((el) => (el.onchange = previewImport));
    previewImport();
  } catch (err) {
    importCandidate = null;
    $("applyImport").disabled = true;
    $("import-report").textContent = err.message;
    if (!$("import-dialog").open && pendingImport?.csv) throw err;
  }
}
function previewImport() {
  const mapping = Object.fromEntries(
    [...$("columnMapping").querySelectorAll("select")].map((el) => [
      el.dataset.map,
      Number(el.value),
    ]),
  );
  const mapped = new Set(Object.values(mapping).filter((i) => i >= 0));
  const duplicateMapping =
    mapped.size !== Object.values(mapping).filter((i) => i >= 0).length;
  importCandidate = GTO.mapRows(
    pendingImport.table.rows,
    mapping,
    pendingImport.table.rowOffset || 0,
  );
  const d = GTO.duplicateNumbers(importCandidate.people);
  const invalid = importCandidate.people.filter(
    (p) => GTO.validate(p, d).length,
  ).length;
  $("import-report").textContent =
    `Строк к загрузке: ${importCandidate.people.length}. Требуют проверки: ${invalid}. Пропущено пустых или несопоставленных строк: ${importCandidate.skipped}.${duplicateMapping ? " Один столбец назначен нескольким полям — исправьте сопоставление." : ""}${!mapped.size ? " Выберите столбцы в сопоставлении." : ""}`;
  $("applyImport").disabled =
    !importCandidate.people.length || duplicateMapping;
  $("import-table").innerHTML =
    "<caption>Первые 5 записей после сопоставления</caption><thead><tr>" +
    Object.values(GTO.fields)
      .map((l) => `<th scope="col">${l}</th>`)
      .join("") +
    "</tr></thead><tbody>" +
    importCandidate.people
      .slice(0, 5)
      .map(
        (p) =>
          "<tr>" +
          Object.keys(GTO.fields)
            .map((k) => `<td>${esc(p[k])}</td>`)
            .join("") +
          "</tr>",
      )
      .join("") +
    "</tbody>";
}
function loadPrinterProfiles() {
  printers = {};
  activePrinter = "";
  // Migrate only non-personal printer settings. Existing legacy coordinates stay intact.
  const stored = jsonRead(templateSetting("gto-printer-profiles"));
  if (
    stored?.version === 1 &&
    stored.profiles &&
    typeof stored.profiles === "object"
  ) {
    for (const [id, p] of Object.entries(stored.profiles).slice(0, 50))
      try {
        printers[id] = {
          name: String(p.name || "Принтер").slice(0, 80),
          ...validConfiguration(p),
        };
      } catch {}
    activePrinter = Object.hasOwn(printers, stored.activeId)
      ? stored.activeId
      : Object.keys(printers)[0];
  }
  if (!Object.keys(printers).length) {
    activePrinter = crypto.randomUUID();
    printers[activePrinter] = {
      name:
        readSetting(templateSetting("gto-profile-name")) || "Основной принтер",
      ...configuration(),
    };
  }
  profileOptions();
}
function switchBlankType(type) {
  if (!Object.hasOwn(blankTypes, type) || type === blankType) return;
  save();
  blankType = type;
  writeSetting("gto-blank-type", blankType);
  loadTemplateConfiguration();
  fields = formLabels();
  activeField = "surname";
  loadPrinterProfiles();
  $("profileName").value = printers[activePrinter].name;
  $("dx").value = offset.dx;
  $("dy").value = offset.dy;
  $("fieldSelect").innerHTML = Object.entries(fields)
    .map(([k, label]) => `<option value="${k}">${esc(label)}</option>`)
    .join("");
  calibrationPast = [JSON.stringify(configuration())];
  calibrationFuture = [];
  positions();
  render();
  fitPreviews();
  calibrationSaved();
  notify(
    `Выбран ${blankTypes[type].label.toLowerCase()} бланк, 140 × 95 мм. Калибровка и профили хранятся отдельно для каждого типа.`,
  );
}
function initWorkspace() {
  loadPrinterProfiles();
  for (const radio of document.querySelectorAll('[name="blankType"]'))
    radio.addEventListener("change", () => switchBlankType(radio.value));
  const draft = jsonRead("gto-participant-draft");
  if (
    draft?.version === 1 &&
    draft.expiresAt > Date.now() &&
    draft.expiresAt <= Date.now() + 24 * 60 * 60 * 1000 &&
    Array.isArray(draft.people) &&
    draft.people.length <= 10000
  ) {
    people = draft.people.map((p) =>
      Object.fromEntries(
        Object.keys(GTO.fields).map((k) => [
          k,
          String(p?.[k] ?? "").slice(0, 10000),
        ]),
      ),
    );
    selected = 0;
    $("keepDraft").checked = true;
    peopleDirty = true;
    draftTimer = setTimeout(() => {
      removeSetting("gto-participant-draft");
      $("keepDraft").checked = false;
      updateDataState();
    }, draft.expiresAt - Date.now());
    notify("Восстановлен локальный черновик участников.");
  } else removeSetting("gto-participant-draft");
  workspaceReady = true;
  calibrationPast = [JSON.stringify(configuration())];
  calibrationSaved();
  $("fieldSelect").innerHTML = Object.entries(fields)
    .map(([k, label]) => `<option value="${k}">${label}</option>`)
    .join("");
  $("fieldSelect").onchange = () => {
    activeField = $("fieldSelect").value;
    syncFieldTools();
  };
  $("page").addEventListener("focusin", (e) => {
    if (e.target.dataset.key) {
      activeField = e.target.dataset.key;
      syncFieldTools();
    }
  });
  $("selectedFont").onchange = () => {
    const n = Number($("selectedFont").value);
    if (n >= 4 && n <= 72) {
      cfg[activeField].size = n;
      save();
      positions();
      draw();
    } else {
      notify("Размер шрифта — от 4 до 72 пт.", true);
      syncFieldTools();
    }
  };
  $("fitField").onclick = fitSelectedField;
  document
    .querySelectorAll("[data-nudge]")
    .forEach(
      (el) =>
        (el.onclick = () => nudge(...el.dataset.nudge.split(",").map(Number))),
    );
  $("zoomEditor").onclick = () => {
    const wrap = $("calibration-preview");
    const on = wrap.classList.toggle("is-zoomed");
    $("zoomEditor").setAttribute("aria-pressed", String(on));
    $("zoomEditor").textContent = on ? "Вписать макет" : "Увеличить макет";
    fitPreviews();
  };
  $("undoCalibration").onclick = () => {
    if (calibrationPast.length < 2) return;
    calibrationFuture.push(calibrationPast.pop());
    restoringCalibration = true;
    applyConfiguration(JSON.parse(calibrationPast.at(-1)));
    restoringCalibration = false;
    calibrationSaved();
  };
  $("redoCalibration").onclick = () => {
    if (!calibrationFuture.length) return;
    const next = calibrationFuture.pop();
    calibrationPast.push(next);
    restoringCalibration = true;
    applyConfiguration(JSON.parse(next));
    restoringCalibration = false;
    calibrationSaved();
  };
  $("exportPeople").onclick = () => {
    downloadFile(
      "gto_participants.csv",
      GTO.csv(people),
      "text/csv;charset=utf-8",
    );
    peopleDirty = false;
    updateDataState();
    notify(
      "CSV подготовлен к скачиванию. Убедитесь, что браузер сохранил файл.",
    );
  };
  $("undoPeople").onclick = () => {
    if (!peoplePast.length) return;
    people = JSON.parse(peoplePast.pop());
    lastPeopleCheckpoint = "";
    selected = Math.min(selected, Math.max(0, people.length - 1));
    peopleChanged();
    render();
  };
  $("keepDraft").onchange = () => {
    persistDraft();
    updateDataState();
  };
  $("clearPeople").onclick = () => {
    if (
      !confirm(
        "Удалить список участников и локальный черновик? Сначала скачайте CSV, если он нужен.",
      )
    )
      return;
    people = [];
    pendingImport = null;
    importCandidate = null;
    pendingPrint = [];
    $("import-table").replaceChildren();
    $("import-file").textContent = "";
    $("print-root").replaceChildren();
    peoplePast = [];
    lastPeopleCheckpoint = "";
    selected = 0;
    peopleDirty = false;
    $("keepDraft").checked = false;
    clearTimeout(draftTimer);
    removeSetting("gto-participant-draft");
    updateDataState();
    render();
    notify("Участники и локальный черновик удалены.");
  };
  window.addEventListener("beforeunload", (e) => {
    if (peopleDirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  $("profileSelect").onchange = () => {
    const id = $("profileSelect").value;
    if (!printers[id]) return;
    const prior = printers[activePrinter];
    if (
      prior &&
      JSON.stringify({ fields: prior.fields, offset: prior.offset }) !==
        JSON.stringify(configuration()) &&
      !confirm(
        "Есть изменения калибровки без сохранения в профиль. Переключить принтер и отменить их?",
      )
    ) {
      $("profileSelect").value = activePrinter;
      return;
    }
    activePrinter = id;
    restoringCalibration = true;
    applyConfiguration(printers[id]);
    restoringCalibration = false;
    calibrationPast = [JSON.stringify(configuration())];
    calibrationFuture = [];
    $("profileName").value = printers[id].name;
    writeSetting(templateSetting("gto-profile-name"), printers[id].name);
    persistProfiles();
    calibrationSaved();
  };
  $("deleteProfile").onclick = () => {
    if (Object.keys(printers).length < 2) return;
    if (
      !confirm(
        `Удалить профиль «${printers[activePrinter].name}»? Сначала скачайте калибровку, если нужна копия.`,
      )
    )
      return;
    delete printers[activePrinter];
    activePrinter = Object.keys(printers)[0];
    restoringCalibration = true;
    applyConfiguration(printers[activePrinter]);
    restoringCalibration = false;
    calibrationPast = [JSON.stringify(configuration())];
    calibrationFuture = [];
    $("profileName").value = printers[activePrinter].name;
    writeSetting(
      templateSetting("gto-profile-name"),
      printers[activePrinter].name,
    );
    persistProfiles();
    profileOptions();
    calibrationSaved();
    notify("Профиль удалён. Выбран другой сохранённый принтер.");
  };
  $("exportProfiles").onclick = () => {
    const profiles = clone(printers);
    if (
      JSON.stringify(configuration()) !==
      JSON.stringify({
        fields: printers[activePrinter].fields,
        offset: printers[activePrinter].offset,
      })
    )
      profiles[crypto.randomUUID()] = {
        name: "Текущая калибровка",
        ...configuration(),
      };
    downloadFile(
      `gto_printers_${blankType}.json`,
      JSON.stringify(
        {
          version: 1,
          template: blankType,
          paper: PAPER,
          profiles: Object.values(profiles),
        },
        null,
        2,
      ),
      "application/json",
    );
  };
  $("importProfiles").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      if (file.size > 1024 * 1024)
        throw Error("Калибровка должна быть меньше 1 МБ.");
      const value = JSON.parse(await file.text());
      if (value.template && value.template !== blankType)
        throw Error("Сначала выберите тип бланка из файла калибровки.");
      if (
        value.version !== 1 ||
        !Array.isArray(value.profiles) ||
        !value.profiles.length ||
        value.profiles.length > 30
      )
        throw Error("Нужен файл профилей ГТО версии 1 (1–30 профилей).");
      const parsed = value.profiles.map((p) => ({
        name: String(p.name || "Импортированный принтер").slice(0, 80),
        ...validConfiguration(p),
      }));
      if (Object.keys(printers).length + parsed.length > 50)
        throw Error("Можно хранить не больше 50 профилей.");
      for (const p of parsed) {
        const base = p.name;
        let suffix = 2;
        while (
          Object.values(printers).some((existing) => existing.name === p.name)
        )
          p.name = base.slice(0, 60) + ` (импорт ${suffix++})`;
        printers[crypto.randomUUID()] = p;
      }
      const persisted = persistProfiles();
      profileOptions();
      if (persisted)
        notify(
          `Добавлено профилей: ${parsed.length}. Выберите нужный принтер в списке.`,
        );
    } catch (err) {
      notify(err.message || "Не удалось импортировать калибровку.", true);
    } finally {
      e.target.value = "";
    }
  };
  $("importEncoding").onchange = rebuildImport;
  $("importSheet").onchange = rebuildImport;
  const cancelImport = () => {
    $("import-dialog").close();
    pendingImport = null;
    importCandidate = null;
    notify("Импорт отменён. Список не изменён.");
  };
  $("cancelImport").onclick = cancelImport;
  $("import-dialog").addEventListener("cancel", () => {
    pendingImport = null;
    importCandidate = null;
  });
  $("applyImport").onclick = () => {
    if (!importCandidate?.people.length) return;
    if (
      people.length &&
      !confirm(
        "Заменить текущий список участниками из файла? Перед заменой можно скачать заполненный CSV.",
      )
    )
      return;
    checkpointPeople();
    people = importCandidate.people;
    selected = 0;
    $("search").value = "";
    const name = pendingImport.name,
      skipped = importCandidate.skipped;
    $("import-dialog").close();
    pendingImport = null;
    importCandidate = null;
    peopleChanged();
    render();
    notify(
      `Готово: ${name}. Загружено участников: ${people.length}. Пропущено строк: ${skipped}.`,
    );
  };
  $("cancelPrint").onclick = () => {
    $("print-review").close();
    pendingPrint = [];
  };
  $("confirmPrint").onclick = () => {
    const list = pendingPrint;
    pendingPrint = [];
    $("print-review").close();
    if (list.length) performPrint(list);
  };
  if (new URLSearchParams(location.search).has("editor"))
    document.body.classList.add("editor-mode");
  render();
  updateDataState();
  document.fonts?.ready.then(() => {
    if (workspaceReady) updateValidation();
  });
}
