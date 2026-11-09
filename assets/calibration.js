// Screen-only blank references and a diagnostic print, independent of participant data.
(() => {
  const references = new Map();
  const upload = document.getElementById("blankReference");
  const opacity = document.getElementById("referenceOpacity");
  const remove = document.getElementById("removeReference");
  const status = document.getElementById("referenceStatus");
  let request = 0;
  function sync() {
    const reference = references.get(blankType);
    for (const page of document.querySelectorAll(".page")) {
      let image = page.querySelector(".blank-reference-image");
      if (!reference) image?.remove();
      else {
        if (!image) {
          image = document.createElement("img");
          image.className = "blank-reference-image";
          image.alt = "";
          image.setAttribute("aria-hidden", "true");
          page.prepend(image);
        }
        if (image.getAttribute("src") !== reference.url)
          image.src = reference.url;
        image.style.opacity = String(Number(opacity.value) / 100);
      }
      page.classList.toggle("has-reference", Boolean(reference));
    }
    remove.disabled = !reference;
    opacity.disabled = !reference;
    const message = reference
      ? `Подложка «${reference.name}» для ${blankTypes[blankType].label.toLowerCase()} бланка. Только на экране, до закрытия страницы.`
      : "Сейчас показана условная схема. Для точного совмещения загрузите ровный скан своего разворота, обрезанный по краям, 140 × 95 мм. Фото под углом не подходит.";
    if (status.textContent !== message) status.textContent = message;
  }
  window.syncBlankReference = sync;
  upload.addEventListener("change", async () => {
    const ticket = ++request;
    const type = blankType;
    const file = upload.files?.[0];
    if (!file) return;
    let url;
    try {
      if (!/^image\/(png|jpeg|webp)$/.test(file.type))
        throw Error("Нужен скан в PNG, JPEG или WebP.");
      if (file.size > 10 * 1024 * 1024)
        throw Error("Скан должен быть не больше 10 МБ.");
      url = URL.createObjectURL(file);
      const image = new Image();
      image.src = url;
      await image.decode();
      const ratio = image.naturalWidth / image.naturalHeight;
      if (Math.abs(ratio / (PAPER.width / PAPER.height) - 1) > 0.03)
        throw Error(
          "Обрежьте скан по краям разворота 140 × 95 мм и расположите горизонтально. Подложка с другими пропорциями исказит совмещение.",
        );
      if (ticket !== request || type !== blankType) return;
      const old = references.get(type);
      references.set(type, { url, name: file.name });
      url = null;
      sync();
      if (old) URL.revokeObjectURL(old.url);
      notify(
        "Подложка загружена только в память браузера. Совместите текст с реальными строками и сохраните профиль принтера.",
      );
    } catch (error) {
      notify(error.message || "Не удалось открыть скан.", true);
    } finally {
      if (url) URL.revokeObjectURL(url);
      upload.value = "";
    }
  });
  opacity.addEventListener("input", sync);
  remove.addEventListener("click", () => {
    request++;
    const prior = references.get(blankType);
    references.delete(blankType);
    sync();
    if (prior) URL.revokeObjectURL(prior.url);
  });
  document.getElementById("printCalibration").addEventListener("click", () => {
    const horizontalTicks = Array.from(
      { length: 11 },
      (_, i) =>
        `<path d="M${20 + i * 10} 18v4"/><text x="${20 + i * 10}" y="27">${i * 10}</text>`,
    ).join("");
    const verticalTicks = Array.from(
      { length: 7 },
      (_, i) =>
        `<path d="M18 ${20 + i * 10}h4"/><text x="13" y="${21 + i * 10}">${i * 10}</text>`,
    ).join("");
    document.getElementById("print-root").innerHTML =
      `<section class="print-sheet" data-calibration="true"><svg xmlns="http://www.w3.org/2000/svg" width="140mm" height="95mm" viewBox="0 0 140 95" aria-label="Контрольный лист 140 на 95 миллиметров">
      <g fill="none" stroke="black" stroke-width=".2"><path d="M20 20h100M20 20v60"/><rect x="110" y="70" width="5" height="5"/>
      <g font-family="Arial,sans-serif" font-size="2.7" fill="black" stroke="none" text-anchor="middle">${horizontalTicks.replaceAll("<path ", '<path stroke="black" ')}${verticalTicks.replaceAll("<path ", '<path stroke="black" ')}</g></g>
      <g font-family="Arial,sans-serif" font-size="3" fill="black"><text x="38" y="12">Горизонтальная линейка: 100 мм</text><text x="34" y="42">Вертикальная линейка: 60 мм</text><text x="34" y="50">Начало линеек: 20 мм от левого</text><text x="34" y="55">и верхнего края листа.</text><text x="105" y="81">5 × 5 мм</text><text x="20" y="90">Бумага 140 × 95 мм. Масштаб 100%. Без колонтитулов.</text></g></svg></section>`;
    window.print();
  });
  sync();
})();
