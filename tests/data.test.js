import test from "node:test";
import assert from "node:assert/strict";
await import("../assets/data.js");
const G = globalThis.GTO;
const person = {
  number: "123",
  surname: "Иванов",
  first: "Иван",
  middle: "",
  level: "V",
  orderDate: "29.02.2024",
  orderNumber: "153 НГ",
  issued: "01.03.2024",
  authority: "",
  signerPosition: "",
  signerName: "",
};
test("required fields permit absent patronymic but reject absent name", () => {
  assert.deepEqual(G.validate(person), []);
  assert.ok(
    G.validate({ ...person, first: "" }).some((e) => e.key === "first"),
  );
});
test("calendar dates are strict and include leap years", () => {
  for (const date of [
    "31.02.2025",
    "29.02.2025",
    "00.01.2025",
    "12.13.2025",
    "07.2025",
  ])
    assert.equal(G.validDate(date), false, date);
  assert.equal(G.validDate("29.02.2024"), true);
});
test("partial date retains missing day and cannot become valid", () => {
  const table = G.parseCSV(
    "Номер удостоверения;Приказ месяц;Приказ год\n123;7;2025",
  );
  const p = G.mapRows(table.rows, G.suggest(table.headers)).people[0];
  assert.equal(p.orderDate, "??.07.2025");
  assert.equal(G.validDate(p.orderDate), false);
});
test("duplicates ignore surrounding spaces and letter case", () => {
  const rows = [
    { ...person, number: " a123 " },
    { ...person, number: "A123" },
  ];
  assert.equal(G.duplicateNumbers(rows).size, 1);
  assert.ok(
    G.validate(rows[0], G.duplicateNumbers(rows)).some(
      (e) => e.key === "number",
    ),
  );
});
test("quoted CSV, multiline values and TSV preserve columns", () => {
  const t = G.parseCSV('Фамилия;Имя\n"Иванов; Петров";"Анна\nМария"');
  assert.equal(t.rows[0][0], "Иванов; Петров");
  assert.equal(t.rows[0][1], "Анна\nМария");
  assert.deepEqual(G.parseCSV("Фамилия\tИмя\nИванов\tИван").rows, [
    ["Иванов", "Иван"],
  ]);
});
test("exports reimport full dates, numbers, Cyrillic and quotes", () => {
  const original = { ...person, surname: 'Иванов "Старший"; Петров' };
  const t = G.parseCSV(G.csv([original]));
  const rows = G.mapRows(t.rows, G.suggest(t.headers)).people;
  delete rows[0]._row;
  assert.deepEqual(rows, [original]);
});
test("retains partial records and counts unmapped/empty rows", () => {
  const result = G.mapRows(
    [
      ["123", ""],
      ["", ""],
      ["", "Имя"],
    ],
    { number: 0, first: 1 },
  );
  assert.equal(result.people.length, 2);
  assert.equal(result.skipped, 1);
});
test("CSV neutralizes spreadsheet formula prefixes", () => {
  assert.ok(G.csv([{ ...person, surname: "=1+1" }]).includes("'=1+1"));
});
test("source line numbers account for Excel range offset and skipped blank rows", () => {
  const result = G.mapRows([["123"], [""], ["456"]], { number: 0 }, 4);
  assert.deepEqual(
    result.people.map((p) => p._row),
    [6, 8],
  );
});

test("silver and bronze issuer details survive CSV export/import", () => {
  const original = {
    ...person,
    authority: 'Учебный орган "Спорт"',
    signerPosition: "Руководитель",
    signerName: "Примеров И. И.",
  };
  const table = G.parseCSV(G.csv([original]));
  const [row] = G.mapRows(table.rows, G.suggest(table.headers)).people;
  delete row._row;
  assert.deepEqual(row, original);
});
