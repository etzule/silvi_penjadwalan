
const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

// Load env from root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function initNotificationLogs() {
    let connection;
    try {
        connection = await pool.getConnection();
        console.log('Connected to database...');

        // Create table if not exists
        await connection.query(`
      CREATE TABLE IF NOT EXISTS notification_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        notification_type VARCHAR(50) NOT NULL COMMENT 'TODAY_0500, TOMORROW_1700, TOMORROW_2000',
        target_date DATE NOT NULL,
        sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'SUCCESS',
        message TEXT,
        UNIQUE KEY unique_daily_log (notification_type, target_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

        console.log('Table notification_logs ensured.');
    } catch (error) {
        console.error('Error initializing table:', error);
    } finally {
        if (connection) connection.release();
        process.exit();
    }
}

initNotificationLogs();
