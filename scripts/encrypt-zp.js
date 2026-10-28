#!/usr/bin/env node
'use strict';
// Использование:  PIN=1234 node scripts/encrypt-zp.js путь/к/index.html
// Шифрует страницу калькулятора ЗП паролем и записывает zp/app.enc.json. Открытый файл в репозиторий не кладём.
const fs = require('node:fs');
const path = require('node:path');
const { encrypt, decrypt } = require('./lib-crypto');

const input = process.argv[2];
const pin = process.env.PIN;
if (!input || !pin) {
  console.error('Использование: PIN=пароль node scripts/encrypt-zp.js путь/к/index.html');
  process.exit(1);
}
const html = fs.readFileSync(input, 'utf8');
if (!/<html[\s>]/i.test(html)) { console.error('Это не похоже на HTML-страницу. Файл не записан.'); process.exit(1); }
const enc = encrypt(html, pin);
if (decrypt(enc, pin) !== html) { console.error('Проверка расшифровки не прошла. Файл не записан.'); process.exit(1); }
fs.writeFileSync(path.join(__dirname, '..', 'zp', 'app.enc.json'), JSON.stringify(enc) + '\n');
console.log('Калькулятор ЗП зашифрован: zp/app.enc.json (' + Math.round(html.length / 1024) + ' КБ исходник)');
