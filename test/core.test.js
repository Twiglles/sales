'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../src/core.js');
const { encrypt, decrypt } = require('../scripts/lib-crypto.js');

const sample = fs.readFileSync(path.join(__dirname, 'fixtures', 'sample.txt'), 'utf8');
const NOW = new Date('2026-10-04T12:00:00');

test('num: убирает пробелы и символы, пустое = 0', () => {
  assert.equal(C.num('12 000 ₽'), 12000);
  assert.equal(C.num(''), 0);
  assert.equal(C.num(undefined), 0);
  assert.equal(C.num('-'), 0);
});

test('build: находит месяц, отдел и менеджеров', () => {
  const months = C.build(sample, NOW);
  assert.equal(months.length, 1);
  const m = months[0];
  assert.equal(m.name, 'Октябрь');
  assert.equal(m.idx, 10);
  assert.equal(m.days, 4);
  assert.deepEqual(m.mgrs.map((x) => x.name), ['Кристина', 'Соня']);
  assert.equal(m.dept.plan, 1000000);
  assert.equal(m.dept.real, 500000);
});

test('Факт ищется как сумма дней: План, случайно равный сумме остальных ячеек, не подходит', () => {
  // 44 (План) = 14 (Реал. План) + 15 (Факт) + 15 (сумма дней): План случайно равен сумме остальных ячеек, а Факт на самом деле 15
  const kristina = C.build(sample, NOW)[0].mgrs[0];
  assert.equal(kristina.inv, 15);
  assert.equal(kristina.kp, 3);
  assert.equal(kristina.out, 8);
});

test('касса считается по строке «Деньги в кассе», а не по плану', () => {
  const a = C.aggregate(C.build(sample, NOW));
  assert.equal(a.totals.cash, 60000);
  assert.equal(a.totals.pay, 2);
});

test('aggregate: неоплаченные счета и их оценка', () => {
  const a = C.aggregate(C.build(sample, NOW));
  const k = a.mgrs.find((x) => x.name === 'Кристина');
  assert.equal(k.unpaid, 14); // 15 счетов - 1 оплата
  assert.equal(k.unpaidValue, 14 * 40000); // средний чек Кристины 40 000 ₽
});

test('месяц в процессе: elapsed считается от текущей даты', () => {
  assert.equal(C.build(sample, new Date('2026-10-02T09:00:00'))[0].elapsed, 2);
  assert.equal(C.build(sample, new Date('2026-11-15T09:00:00'))[0].elapsed, 4);
  assert.equal(C.build(sample, new Date('2026-09-15T09:00:00'))[0].elapsed, 0);
});

test('checks: цельная таблица без расхождений по кассе и оплатам', () => {
  const kinds = C.checks(C.build(sample, NOW)).map((c) => c.kind);
  assert.ok(!kinds.includes('cash-mgr'));
  assert.ok(!kinds.includes('pay-mgr'));
  assert.ok(!kinds.includes('cash-head'));
});

test('checks: расхождение кассы отдела и менеджеров находится', () => {
  const broken = sample.replace('Деньги в кассе,500000,250000,20000,0,0,20000,0', 'Деньги в кассе,500000,250000,50000,0,0,50000,0');
  const kinds = C.checks(C.build(broken, NOW)).map((c) => c.kind);
  assert.ok(kinds.includes('cash-mgr'));
});

test('parse: пустой и мусорный текст не ломает разбор', () => {
  assert.deepEqual(C.build('', NOW), []);
  assert.deepEqual(C.build('просто текст\nбез листов', NOW), []);
});

test('шифрование: круг туда и обратно, неверный пароль отвергается', () => {
  const enc = encrypt(sample, '0000');
  assert.equal(decrypt(enc, '0000'), sample);
  assert.throws(() => decrypt(enc, '1111'));
  assert.equal(enc.n, 300000);
});

test('шифрование: каждый раз новая соль и вектор', () => {
  const a = encrypt('x', '1'), b = encrypt('x', '1');
  assert.notEqual(a.s, b.s);
  assert.notEqual(a.i, b.i);
});
