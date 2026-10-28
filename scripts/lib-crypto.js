'use strict';
// Шифрование данных: PBKDF2-SHA256 + AES-256-GCM. Формат совпадает с расшифровкой в src/app.js (WebCrypto).
const crypto = require('node:crypto');

const ITERATIONS = 300000;

function encrypt(text, pin) {
  if (!pin) throw new Error('Не задан пароль (переменная окружения PIN)');
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(String(pin), salt, ITERATIONS, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const ct = Buffer.concat([body, cipher.getAuthTag()]); // тег аутентификации в конце, как ждёт WebCrypto
  return { s: salt.toString('base64'), i: iv.toString('base64'), c: ct.toString('base64'), n: ITERATIONS };
}

function decrypt(enc, pin) {
  const salt = Buffer.from(enc.s, 'base64');
  const iv = Buffer.from(enc.i, 'base64');
  const ct = Buffer.from(enc.c, 'base64');
  const key = crypto.pbkdf2Sync(String(pin), salt, enc.n, 32, 'sha256');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(ct.subarray(ct.length - 16));
  return Buffer.concat([decipher.update(ct.subarray(0, ct.length - 16)), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt, ITERATIONS };
