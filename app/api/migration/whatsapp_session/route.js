
import pool from '../../../../lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
    let connection;
    try {
        connection = await pool.getConnection();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS whatsapp_sessions (
                id VARCHAR(191) NOT NULL PRIMARY KEY,
                data JSON NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
        return NextResponse.json({ success: true, message: 'Table whatsapp_sessions created' });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
