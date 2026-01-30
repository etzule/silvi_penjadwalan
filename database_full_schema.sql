-- ============================================
-- FULL DATABASE SCHEMA
-- Sistem Penjadwalan Kegiatan Kelurahan
-- ============================================

-- 1. Buat database (jika belum ada)
CREATE DATABASE IF NOT EXISTS penjadwalan_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE penjadwalan_db;

-- ============================================
-- 2. Tabel Users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  full_name VARCHAR(255) NULL,
  email VARCHAR(255) NOT NULL UNIQUE,
  whatsapp VARCHAR(30) UNIQUE NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('lurah', 'sekretaris kelurahan', 'admin') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_role (role),
  INDEX idx_email (email),
  INDEX idx_full_name (full_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 3. Tabel Schedules
-- ============================================
CREATE TABLE IF NOT EXISTS schedules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  location VARCHAR(255) NULL COMMENT 'Lokasi/tempat kegiatan',
  schedule_date DATE NOT NULL,
  schedule_time TIME NULL COMMENT 'Waktu mulai kegiatan',
  schedule_end_time TIME NULL COMMENT 'Waktu selesai kegiatan (optional)',
  creator_id INT NULL,
  target_role ENUM('lurah', 'sekretaris kelurahan') NULL,
  tujuan_jabatan JSON DEFAULT ('[]'),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_schedule_date (schedule_date),
  INDEX idx_creator_id (creator_id),
  INDEX idx_target_role (target_role),
  INDEX idx_location (location)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 5. Tabel Email Notification Log
-- ============================================
CREATE TABLE IF NOT EXISTS email_notification_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  subject VARCHAR(255) NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('success', 'failed') DEFAULT 'success',
  error_message TEXT NULL,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  INDEX idx_schedule_id (schedule_id),
  INDEX idx_sent_at (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 6. Tabel WhatsApp Notification Log
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_notification_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  schedule_id INT NOT NULL,
  recipient_phone VARCHAR(30) NOT NULL,
  message TEXT NOT NULL,
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  status ENUM('success', 'failed') DEFAULT 'success',
  error_message TEXT NULL,
  FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
  INDEX idx_schedule_id (schedule_id),
  INDEX idx_sent_at (sent_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 7. Tabel Schedule Logs (Audit Trail)
-- ============================================
CREATE TABLE IF NOT EXISTS schedule_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    schedule_id INT NOT NULL,
    action_type VARCHAR(20) NOT NULL, -- 'UPDATE', 'DELETE'
    old_data JSON, -- stores previous state
    new_data JSON, -- stores new state
    changed_fields TEXT, -- description of changes
    editor_id INT, -- user who made change
    editor_name VARCHAR(100), -- cached username
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 8. Tabel Notification Logs (Cron Automation)
-- ============================================
CREATE TABLE IF NOT EXISTS notification_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    notification_type VARCHAR(50) NOT NULL COMMENT 'TODAY_0500, TOMORROW_1700, TOMORROW_2000',
    target_date DATE NOT NULL,
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'SUCCESS',
    message TEXT,
    UNIQUE KEY unique_daily_log (notification_type, target_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 8b. Tabel WhatsApp Sessions (Railway Persistence)
-- ============================================
CREATE TABLE IF NOT EXISTS whatsapp_sessions (
    id VARCHAR(191) NOT NULL PRIMARY KEY,
    data JSON NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================
-- 9. Insert Data Sample (Optional)
-- ============================================

-- Sample Admin User
-- Password: admin123
-- Hash ini adalah contoh, Anda harus generate sendiri menggunakan Node.js script
-- Cara generate: node create-user.js
INSERT INTO users (username, email, password_hash, role) 
VALUES (
    'admin',
    'admin@kelurahan.id',
    'YOUR_PASSWORD_HASH_HERE',  -- GANTI dengan hash yang benar
    'admin'
) ON DUPLICATE KEY UPDATE username=username;

-- Sample Lurah User
-- Password: lurah123
INSERT INTO users (username, email, whatsapp, password_hash, role) 
VALUES (
    'lurah',
    'lurah@kelurahan.id',
    '081234567890',
    'YOUR_PASSWORD_HASH_HERE',  -- GANTI dengan hash yang benar
    'lurah'
) ON DUPLICATE KEY UPDATE username=username;

-- Sample Sekretaris User
-- Password: sekretaris123
INSERT INTO users (username, email, whatsapp, password_hash, role) 
VALUES (
    'sekretaris',
    'sekretaris@kelurahan.id',
    '081234567891',
    'YOUR_PASSWORD_HASH_HERE',  -- GANTI dengan hash yang benar
    'sekretaris kelurahan'
) ON DUPLICATE KEY UPDATE username=username;

-- Sample Schedule
INSERT INTO schedules (title, description, schedule_date, schedule_time, schedule_end_time, creator_id, target_role, tujuan_jabatan)
VALUES (
    'Rapat Koordinasi Bulanan',
    'Rapat koordinasi rutin bulanan membahas program kerja kelurahan',
    '2026-02-01',
    '09:00:00',
    '11:00:00',
    1,  -- Assuming admin user has id 1
    'lurah',
    '["lurah", "sekretaris kelurahan"]'
) ON DUPLICATE KEY UPDATE title=title;

-- ============================================
-- 10. Verifikasi Tabel
-- ============================================
-- Uncomment untuk melihat struktur tabel yang telah dibuat:
-- SHOW TABLES;
-- DESCRIBE users;
-- DESCRIBE schedules;
-- DESCRIBE email_notification_log;
-- DESCRIBE whatsapp_notification_log;
-- DESCRIBE schedule_logs;
-- DESCRIBE notification_logs;

-- ============================================
-- 11. Query Berguna untuk Maintenance
-- ============================================

-- Lihat semua users
-- SELECT id, username, email, whatsapp, role, created_at FROM users;

-- Lihat semua schedules dengan info creator
-- SELECT s.*, u.username AS creator_username, u.role AS creator_role 
-- FROM schedules s 
-- LEFT JOIN users u ON s.creator_id = u.id 
-- ORDER BY s.schedule_date DESC, s.schedule_time DESC;

-- Lihat jadwal hari ini
-- SELECT * FROM schedules WHERE schedule_date = CURDATE();

-- Lihat jadwal minggu ini
-- SELECT * FROM schedules 
-- WHERE schedule_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 7 DAY)
-- ORDER BY schedule_date, schedule_time;

-- Lihat log notifikasi email
-- SELECT el.*, s.title AS schedule_title 
-- FROM email_notification_log el 
-- JOIN schedules s ON el.schedule_id = s.id 
-- ORDER BY el.sent_at DESC 
-- LIMIT 50;

-- Lihat log notifikasi WhatsApp
-- SELECT wl.*, s.title AS schedule_title 
-- FROM whatsapp_notification_log wl 
-- JOIN schedules s ON wl.schedule_id = s.id 
-- ORDER BY wl.sent_at DESC 
-- LIMIT 50;

-- ============================================
-- SELESAI
-- ============================================
