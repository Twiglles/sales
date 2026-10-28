// Вставьте этот код в таблицу: «Расширения → Apps Script».
// Секретное слово задайте ниже (любые буквы и цифры, длиннее 12 знаков) и такое же внесите в секрет GitHub SHEET_KEY.
var SECRET = 'ЗАМЕНИТЕ_НА_СВОЁ_СЕКРЕТНОЕ_СЛОВО';

function doGet(e) {
  var key = e && e.parameter && e.parameter.key;
  if (!key || key !== SECRET || SECRET.indexOf('ЗАМЕНИТЕ') === 0) {
    return ContentService.createTextOutput(JSON.stringify({ error: 'forbidden' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  var sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets().map(function (s) {
    return { name: s.getName(), rows: s.getDataRange().getDisplayValues() };
  });
  return ContentService.createTextOutput(JSON.stringify({ sheets: sheets }))
    .setMimeType(ContentService.MimeType.JSON);
}
