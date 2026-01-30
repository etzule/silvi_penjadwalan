/**
 * Script untuk membuat user admin
 * 
 * Cara menjalankan:
 * 1. Pastikan database sudah di-migrate (role 'admin' sudah ditambahkan)
 * 2. Edit username, email, dan password di bawah ini
 * 3. Jalankan: node scripts/create-admin-user.js
 * 
 * Catatan: Jika error "Cannot use import statement", ubah ke CommonJS:
 * - Ganti "import" dengan "require"
 * - Ganti "export" dengan "module.exports"
 */

const mysql = require('mysql2/promise');
const crypto = require('crypto');
const { randomBytes, scryptSync } = crypto;

const SALT_BYTES = 16;
const KEY_LEN = 64;

// ===== EDIT INI =====
const adminUsername = 'admin';
const adminEmail = 'admin@example.com';
const adminPassword = 'admin123'; // Ganti dengan password yang aman!
const adminRole = 'admin';
// ====================

// Load .env file
require('dotenv').config({ path: require('path').resolve(process.cwd(), '.env') });

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT || 3306,
  database: process.env.DB_NAME || "scheduler",
};

async function createAdminUser() {
  let connection;

  try {
    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✓ Connected to database');

    // Check if user already exists
    const [existing] = await connection.execute(
      'SELECT id FROM users WHERE username = ? OR email = ?',
      [adminUsername, adminEmail]
    );

    if (existing.length > 0) {
      console.log('❌ User dengan username atau email tersebut sudah ada!');
      return;
    }

    // Hash password
    const salt = randomBytes(SALT_BYTES);
    const derived = scryptSync(adminPassword, salt, KEY_LEN);
    const password_hash = `${salt.toString('hex')}:${derived.toString('hex')}`;

    // Insert admin user
    await connection.execute(
      'INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [adminUsername, adminEmail, password_hash, adminRole]
    );

    console.log('✓ Admin user berhasil dibuat!');
    console.log(`  Username: ${adminUsername}`);
    console.log(`  Email: ${adminEmail}`);
    console.log(`  Role: ${adminRole}`);
    console.log(`  Password: ${adminPassword} (simpan dengan aman!)`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code === 'ER_BAD_FIELD_ERROR') {
      console.error('⚠️  Pastikan migration sudah dijalankan! Role "admin" belum ada di database.');
    }
  } finally {
    if (connection) {
      await connection.end();
      console.log('✓ Database connection closed');
    }
  }
}

createAdminUser();

