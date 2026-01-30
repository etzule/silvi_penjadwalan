require('dotenv').config();
const db = require('../lib/db').default || require('../lib/db');

async function init() {
    try {
        console.log('Creating schedule_logs table...');
        await db.query(`
      CREATE TABLE IF NOT EXISTS schedule_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        schedule_id INT NOT NULL,
        action_type VARCHAR(20) NOT NULL,
        old_data JSON,
        new_data JSON,
        changed_fields TEXT,
        editor_id INT,
        editor_name VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
        console.log('Table created successfully.');
        process.exit(0);
    } catch (err) {
        console.error('Error creating table:', err);
        process.exit(1);
    }
}

init();
