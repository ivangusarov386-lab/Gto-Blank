import { writeFileSync } from "node:fs";
import * as XLSX from "@e965/xlsx";
const headers = [
  "Номер удостоверения",
  "Фамилия",
  "Имя",
  "Отчество",
  "Ступень",
  "Дата приказа",
  "Номер приказа",
  "Дата выдачи",
];
const book = XLSX.utils.book_new();
const sheet = XLSX.utils.aoa_to_sheet([
  headers,
  [
    "ЭКС001",
    "Петров",
    "Пётр",
    "",
    "VI",
    new Date(2025, 6, 16),
    "153 НГ",
    new Date(2026, 5, 24),
  ],
]);
sheet.F2.z = sheet.H2.z = "dd.mm.yyyy";
XLSX.utils.book_append_sheet(book, sheet, "Участники");
for (const type of ["xlsx", "biff8"])
  writeFileSync(
    `/tmp/gto-fixture.${type === "biff8" ? "xls" : "xlsx"}`,
    XLSX.write(book, { bookType: type, type: "buffer" }),
  );
