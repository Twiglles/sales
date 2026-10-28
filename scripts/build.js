#!/usr/bin/env node
'use strict';
// Сборка статического сайта в dist/: копирует src/ и подкладывает зашифрованные данные как data.js.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const dataFile = path.join(root, 'data', 'snapshot.enc.json');

if (!fs.existsSync(dataFile)) {
  console.error('Нет файла data/snapshot.enc.json. Создайте его: PIN=… npm run data -- snapshot.txt');
  process.exit(1);
}
const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
for (const k of ['s', 'i', 'c', 'n', 'at']) {
  if (data[k] == null) { console.error('В data/snapshot.enc.json нет поля ' + k); process.exit(1); }
}

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const f of ['index.html', 'styles.css', 'core.js', 'app.js']) {
  fs.copyFileSync(path.join(root, 'src', f), path.join(dist, f));
}
// Калькулятор ЗП: страница входа и зашифрованное приложение, по адресу /zp/
fs.mkdirSync(path.join(dist, 'zp'), { recursive: true });
for (const f of ['index.html', 'app.enc.json']) {
  const src = path.join(root, 'zp', f);
  if (!fs.existsSync(src)) { console.error('Нет файла zp/' + f + '. Создайте его: PIN=… node scripts/encrypt-zp.js index.html'); process.exit(1); }
  fs.copyFileSync(src, path.join(dist, 'zp', f));
}
const payload = { enc: { s: data.s, i: data.i, c: data.c, n: data.n }, at: data.at };
fs.writeFileSync(path.join(dist, 'data.js'), 'window.TWG_DATA = ' + JSON.stringify(payload) + ';\n');
// GitHub Pages не должен пытаться обрабатывать сайт как Jekyll
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

console.log('Сайт собран в dist/ (данные на ' + new Date(data.at).toISOString() + ')');
