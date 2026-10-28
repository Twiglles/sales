'use strict';
// Превращает листы таблицы (массивы строк с отображаемыми значениями) в текст выгрузки, который понимает src/core.js.
// Лист = {name, rows}. Слева в таблице три служебные колонки (A–C), метка показателя стоит в D.

function clean(v) {
  return String(v == null ? '' : v).replace(/ /g, ' ').replace(/,/g, '.').trim();
}

function sheetToText(sheet) {
  const out = ['# ' + String(sheet.name).trim()];
  let sep = -1; // индекс пустой колонки-разделителя между «Факт» и днями
  for (const raw of sheet.rows) {
    const cells = raw.slice(3).map(clean);
    while (cells.length && cells[cells.length - 1] === '') cells.pop();
    if (!cells.length || !cells[0]) continue;
    if (cells[1] === 'План' && (cells[2] === 'Факт' || cells[2] === 'Реал. План')) {
      // шапка блока менеджера или отдела
      sep = cells.findIndex((c, i) => i > 1 && c === '');
      if (sep < 0) sep = -1;
    }
    const row = sep > 0 ? cells.filter((_, i) => i !== sep) : cells;
    // шапка блока: «Имя, План, [Реал. План,] Факт, дни…» — пустых ячеек внутри быть не должно
    out.push(row.join(','));
  }
  return out.join('\n');
}

function toSnapshot(sheets) {
  return sheets.map(sheetToText).join('\n') + '\n';
}

module.exports = { toSnapshot, sheetToText };
