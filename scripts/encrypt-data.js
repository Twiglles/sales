#!/usr/bin/env node
'use strict';
// Использование:  PIN=1234 npm run data -- путь/к/snapshot.txt
// Берёт текст выгрузки таблицы, шифрует паролем и записывает data/snapshot.enc.json.
const fs = require('node:fs');
const path = require('node:path');
const { encrypt, decrypt } = require('./lib-crypto');

const input = process.argv[2];
if (!input) {
  console.error('Укажите файл с выгрузкой таблицы: PIN=… npm run data -- snapshot.txt');
  process.exit(1);
}
const pin = process.env.PIN;
if (!pin) {
  console.error('Задайте пароль страницы в переменной окружения PIN');
  process.exit(1);
}

// Убираем ограждения ``` и пустые строки, цифры не трогаем.
const text = fs.readFileSync(input, 'utf8')
  .split(/\r?\n/)
  .filter((l) => l.trim() && !l.trim().startsWith('```'))
  .join('\n') + '\n';

const Core = require('../src/core.js');
const months = Core.build(text, new Date());
if (!months.length) {
  console.error('В выгрузке не найдено ни одного месяца с отделом и менеджерами. Файл не записан.');
  process.exit(1);
}

const enc = encrypt(text, pin);
if (decrypt(enc, pin) !== text) {
  console.error('Проверка расшифровки не прошла. Файл не записан.');
  process.exit(1);
}

const out = path.join(__dirname, '..', 'data', 'snapshot.enc.json');
fs.writeFileSync(out, JSON.stringify({ ...enc, at: Date.now() }) + '\n');

const a = Core.aggregate(months).totals;
console.log('Данные обновлены:', months.map((m) => m.name).join(', '));
console.log(`касса ${a.cash} ₽, КП ${a.kp}, счета ${a.inv}, оплаты ${a.pay}`);
const bad = Core.checks(months).filter((c) => c.kind === 'cash-mgr' || c.kind === 'pay-mgr');
if (bad.length) console.warn('Внимание: касса или оплаты отдела не сходятся с менеджерами:', bad.map((b) => b.kind + ' ' + b.month).join(', '));
