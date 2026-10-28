'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { decrypt } = require('../scripts/lib-crypto');

const root = path.join(__dirname, '..');

test('приложение ЗП в репозитории зашифровано, открытого текста нет', () => {
  const raw = fs.readFileSync(path.join(root, 'zp', 'app.enc.json'), 'utf8');
  const d = JSON.parse(raw);
  for (const k of ['s', 'i', 'c', 'n']) assert.ok(d[k], 'нет поля ' + k);
  for (const word of ['Кристина', 'script.google.com', 'Посты', 'Расчёт']) assert.ok(!raw.includes(word), 'в файле виден текст: ' + word);
  const shell = fs.readFileSync(path.join(root, 'zp', 'index.html'), 'utf8');
  assert.ok(!shell.includes('script.google.com') && !shell.includes('Кристина'), 'страница входа не должна содержать данных');
});

test('сборка кладёт страницу входа и зашифрованное приложение в dist/zp', () => {
  execFileSync('node', [path.join(root, 'scripts', 'build.js')], { stdio: 'pipe' });
  for (const f of ['index.html', 'app.enc.json']) assert.ok(fs.existsSync(path.join(root, 'dist', 'zp', f)), 'нет dist/zp/' + f);
});

test('неверный пароль не расшифровывает приложение', () => {
  const d = JSON.parse(fs.readFileSync(path.join(root, 'zp', 'app.enc.json'), 'utf8'));
  assert.throws(() => decrypt(d, '0000'));
});
