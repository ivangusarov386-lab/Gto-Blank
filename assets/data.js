// Shared import/export and validation rules. No DOM or participant persistence.
(() => {
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
  const parts = {
    orderDay: "Приказ день",
    orderMonth: "Приказ месяц",
    orderYear: "Приказ год",
    issuedDay: "Выдача день",
    issuedMonth: "Выдача месяц",
    issuedYear: "Выдача год",
  };
  const aliases = {
    number: ["номер удостоверения", "удостоверен", "certificate"],
    surname: ["фамилия", "surname"],
    first: ["имя", "first"],
    middle: ["отчество", "middle"],
    level: ["ступень", "level"],
    orderDate: ["дата приказа", "приказ дата"],
    orderNumber: ["номер приказа", "приказ номер", "order number"],
    issued: ["дата выдачи", "выдача дата"],
  };
  const clean = (value) => String(value ?? "").trim();
  function suggest(headers) {
    return Object.fromEntries(
      Object.keys({ ...fields, ...parts }).map((key) => {
        const wanted = aliases[key] || [parts[key].toLowerCase()];
        return [
          key,
          headers.findIndex((h) =>
            wanted.some((v) => clean(h).toLowerCase() === v),
          ) >= 0
            ? headers.findIndex((h) =>
                wanted.some((v) => clean(h).toLowerCase() === v),
              )
            : headers.findIndex((h) =>
                wanted.some((v) => clean(h).toLowerCase().includes(v)),
              ),
        ];
      }),
    );
  }
  function parseCSV(text) {
    text = text.replace(/^\ufeff/, "");
    if (!text.trim())
      throw Error("Файл пуст. Добавьте заголовки и хотя бы одного участника.");
    let quote = false,
      counts = { ";": 0, ",": 0, "\t": 0 };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quote && text[i + 1] === '"') i++;
        else quote = !quote;
      } else if (!quote) {
        if (c === "\n" || c === "\r") break;
        if (c in counts) counts[c]++;
      }
    }
    const sep = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    let row = [],
      cell = "",
      records = [];
    quote = false;
    const flush = () => {
      row.push(cell);
      records.push(row);
      row = [];
      cell = "";
    };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '"') {
        if (quote && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quote = !quote;
      } else if (c === sep && !quote) {
        row.push(cell);
        cell = "";
      } else if ((c === "\n" || c === "\r") && !quote) {
        flush();
        if (c === "\r" && text[i + 1] === "\n") i++;
      } else cell += c;
    }
    if (quote)
      throw Error(
        "В CSV не закрыты кавычки. Проверьте файл и повторите загрузку.",
      );
    if (cell || row.length) flush();
    const headers = records.shift()?.map(clean);
    if (
      !headers?.some(Boolean) ||
      !records.some((r) => r.some((v) => clean(v)))
    )
      throw Error("В таблице нет участников. Добавьте строки под заголовками.");
    if (records.length > 10000)
      throw Error(
        "В файле больше 10 000 строк. Разделите его на несколько таблиц.",
      );
    return { headers, rows: records };
  }
  function mapRows(rows, mapping, rowOffset = 0) {
    const value = (row, key) =>
      mapping[key] >= 0 ? clean(row[mapping[key]]) : "";
    let skipped = 0;
    const people = rows.flatMap((row, index) => {
      if (!row.some((v) => clean(v))) {
        skipped++;
        return [];
      }
      const p = Object.fromEntries(
        Object.keys(fields).map((k) => [k, value(row, k)]),
      );
      for (const [key, prefix] of [
        ["orderDate", "order"],
        ["issued", "issued"],
      ]) {
        if (!p[key]) {
          const d = value(row, prefix + "Day"),
            m = value(row, prefix + "Month"),
            y = value(row, prefix + "Year");
          p[key] =
            d || m || y
              ? [
                  d ? d.padStart(2, "0") : "??",
                  m ? m.padStart(2, "0") : "??",
                  y || "????",
                ].join(".")
              : "";
        }
      }
      // Keep partial records, including names without a certificate number, for correction.
      if (!Object.values(p).some(Boolean)) {
        skipped++;
        return [];
      }
      p._row = index + 2 + rowOffset;
      return [p];
    });
    return { people, skipped };
  }
  function validDate(value) {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
    if (!m) return false;
    const [, d, month, y] = m.map(Number);
    if (y < 1000) return false;
    const date = new Date(Date.UTC(y, month - 1, d));
    return (
      date.getUTCFullYear() === y &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === d
    );
  }
  const roman = [
    "I",
    "II",
    "III",
    "IV",
    "V",
    "VI",
    "VII",
    "VIII",
    "IX",
    "X",
    "XI",
    "XII",
    "XIII",
    "XIV",
    "XV",
    "XVI",
    "XVII",
    "XVIII",
  ];
  function validate(p, duplicates = new Set()) {
    const issues = [];
    for (const key of [
      "number",
      "surname",
      "first",
      "level",
      "orderDate",
      "orderNumber",
      "issued",
    ])
      if (!clean(p[key]))
        issues.push({ key, message: `${fields[key]}: заполните поле` });
    for (const key of ["orderDate", "issued"])
      if (clean(p[key]) && !validDate(clean(p[key])))
        issues.push({
          key,
          message: `${fields[key]}: нужна существующая дата ДД.ММ.ГГГГ`,
        });
    if (
      clean(p.level) &&
      !roman.includes(clean(p.level).toUpperCase()) &&
      !/^(?:[1-9]|1[0-8])$/.test(clean(p.level))
    )
      issues.push({
        key: "level",
        message: "Ступень: укажите I–XVIII или 1–18",
      });
    if (duplicates.has(clean(p.number).toUpperCase()))
      issues.push({
        key: "number",
        message: "Номер удостоверения повторяется в списке",
      });
    return issues;
  }
  function duplicateNumbers(people) {
    const seen = new Set(),
      duplicates = new Set();
    for (const p of people) {
      const n = clean(p.number).toUpperCase();
      if (n && seen.has(n)) duplicates.add(n);
      seen.add(n);
    }
    return duplicates;
  }
  function csv(people) {
    const quote = (value) => {
      let s = String(value ?? "");
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return '"' + s.replaceAll('"', '""') + '"';
    };
    return (
      "\ufeff" +
      [
        Object.values(fields),
        ...people.map((p) => Object.keys(fields).map((k) => p[k] ?? "")),
      ]
        .map((r) => r.map(quote).join(";"))
        .join("\r\n") +
      "\r\n"
    );
  }
  globalThis.GTO = {
    fields,
    parts,
    suggest,
    parseCSV,
    mapRows,
    validDate,
    validate,
    duplicateNumbers,
    csv,
  };
})();
