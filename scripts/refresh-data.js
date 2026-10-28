#!/usr/bin/env node
'use strict';
// Автообновление: забирает листы из Google Apps Script, собирает выгрузку, шифрует и пишет data/snapshot.enc.json.
// Переменные окружения: SHEET_URL (адрес веб-приложения Apps Script), SHEET_KEY (секретное слово), PIN (пароль страницы).
const fs = require('node:fs');
const path = require('node:path');
const { encrypt, decrypt } = require('./lib-crypto');
const { toSnapshot } = require('./sheet-to-snapshot');
const Core = require('../src/core.js');

const out = path.join(__dirname, '..', 'data', 'snapshot.enc.json');

async function main() {
  const { SHEET_URL, SHEET_KEY, PIN } = process.env;
  for (const [k, v] of Object.entries({ SHEET_URL, SHEET_KEY, PIN })) {
    if (!v) { console.error('Не задана переменная ' + k + ' (секрет в настройках GitHub)'); process.exit(1); }
  }
  const url = new URL(SHEET_URL);
  url.searchParams.set('key', SHEET_KEY);
  const res = await fetch(url, { redirect: 'follow' });
  const body = await res.text();
  let json;
  try { json = JSON.parse(body); } catch (e) { json = null; }
  if (!res.ok || !json || !Array.isArray(json.sheets)) {
    console.error('Таблица не отдала данные (HTTP ' + res.status + '). Проверьте адрес, секретное слово и доступ «Все» у веб-приложения.');
    process.exit(1);
  }
  const text = toSnapshot(json.sheets);
  const months = Core.build(text, new Date());
  if (!months.length) { console.error('В таблице не найдено ни одного месяца с отделом и менеджерами. Файл не изменён.'); process.exit(1); }

  let old = null;
  try { old = decrypt(JSON.parse(fs.readFileSync(out, 'utf8')), PIN); } catch (e) { /* первого файла нет или другой пароль */ }
  if (old === text) { console.log('Данные не изменились, обновлять нечего.'); return; }

  const enc = encrypt(text, PIN);
  if (decrypt(enc, PIN) !== text) { console.error('Проверка расшифровки не прошла. Файл не записан.'); process.exit(1); }
  fs.writeFileSync(out, JSON.stringify({ ...enc, at: Date.now() }) + '\n');
  const a = Core.aggregate(months).totals;
  console.log('Данные обновлены:', months.map((m) => m.name).join(', '));
  console.log(`касса ${a.cash} ₽, КП ${a.kp}, счета ${a.inv}, оплаты ${a.pay}`);
}
main().catch((e) => { console.error(e.message); process.exit(1); });
