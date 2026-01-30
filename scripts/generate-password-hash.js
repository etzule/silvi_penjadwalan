/**
 * Script untuk Generate Password Hash
 * 
 * Cara menggunakan:
 * 1. Edit password di bawah ini
 * 2. Jalankan: node scripts/generate-password-hash.js
 * 3. Copy hash yang dihasilkan
 * 4. Paste ke file create-admin-user.sql
 */

const crypto = require('crypto');

// ===== EDIT PASSWORD DI SINI =====
const password = 'admin123'; // GANTI dengan password yang Anda inginkan
// ==================================

const SALT_BYTES = 16;
const KEY_LEN = 64;

// Generate hash
const salt = crypto.randomBytes(SALT_BYTES);
const hash = crypto.scryptSync(password, salt, KEY_LEN);
const password_hash = `${salt.toString('hex')}:${hash.toString('hex')}`;

console.log('\n========================================');
console.log('PASSWORD HASH GENERATED');
console.log('========================================\n');
console.log('Password:', password);
console.log('\nHash (copy ini):');
console.log(password_hash);
console.log('\n========================================');
console.log('\nCara menggunakan:');
console.log('1. Copy hash di atas');
console.log('2. Buka file create-admin-user.sql');
console.log('3. Ganti YOUR_PASSWORD_HASH_HERE dengan hash di atas');
console.log('4. Jalankan query INSERT di MySQL');
console.log('========================================\n');

