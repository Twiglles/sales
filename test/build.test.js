'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');

test('данные в репозитории зашифрованы и полны', () => {
  const d = JSON.parse(fs.readFileSync(path.join(root, 'data', 'snapshot.enc.json'), 'utf8'));
  for (const k of ['s', 'i', 'c', 'n', 'at']) assert.ok(d[k], 'нет поля ' + k);
  assert.equal(d.n, 300000);
  assert.ok(!JSON.stringify(d).includes('Отдел продаж'), 'открытый текст не должен лежать в файле');
});

test('сборка создаёт сайт со всеми файлами', () => {
  execFileSync('node', [path.join(root, 'scripts', 'build.js')], { stdio: 'pipe' });
  for (const f of ['index.html', 'styles.css', 'core.js', 'app.js', 'data.js', '.nojekyll']) {
    assert.ok(fs.existsSync(path.join(root, 'dist', f)), 'нет dist/' + f);
  }
  const html = fs.readFileSync(path.join(root, 'dist', 'index.html'), 'utf8');
  for (const ref of ['styles.css', 'core.js', 'data.js', 'app.js']) assert.ok(html.includes(ref));
  assert.ok(!/(src|href)="\//.test(html), 'пути должны быть относительными (для GitHub Pages)');
  const data = fs.readFileSync(path.join(root, 'dist', 'data.js'), 'utf8');
  assert.ok(data.startsWith('window.TWG_DATA = '));
});
