
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(timezone);

const TIMEZONE = 'Asia/Jakarta'; // WIB

export const dynamic = 'force-dynamic';

export async function GET(request) {
    try {
        const now = dayjs().tz(TIMEZONE);
        const hour = now.hour();
        const todayStr = now.format('YYYY-MM-DD');
        const tomorrowStr = now.add(1, 'day').format('YYYY-MM-DD');

        const results = [];

        // ======== 1. NOTIFIKASI HARI INI (05:00 WIB) ========
        // Logic: Runs if current time >= 05:00.
        if (hour >= 5) {
            const type = 'TODAY_0500';
            const sent = await checkAndSendNotification(type, todayStr, 'today');
            if (sent) results.push({ type, status: 'SENT' });
        }

        // ======== 2. NOTIFIKASI BESOK SORE (17:00 WIB) ========
        if (hour >= 17) {
            const type = 'TOMORROW_1700';
            const sent = await checkAndSendNotification(type, tomorrowStr, 'tomorrow');
            if (sent) results.push({ type, status: 'SENT' });
        }

        // ======== 3. NOTIFIKASI BESOK MALAM (20:00 WIB) ========
        if (hour >= 20) {
            const type = 'TOMORROW_2000';
            const sent = await checkAndSendNotification(type, tomorrowStr, 'tomorrow');
            if (sent) results.push({ type, status: 'SENT' });
        }

        return NextResponse.json({
            success: true,
            time: now.format('HH:mm:ss'),
            results: results.length > 0 ? results : 'No notifications triggered'
        });

    } catch (error) {
        console.error('Cron Check Error:', error);
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}

async function checkAndSendNotification(type, dateStr, eventScope) {
    let connection;
    try {
        connection = await pool.getConnection();

        // 1. Cek apakah sudah dikirim hari ini/untuk tanggal target
        const [existing] = await connection.query(
            'SELECT id FROM notification_logs WHERE notification_type = ? AND target_date = ? LIMIT 1',
            [type, dateStr]
        );

        if (existing.length > 0) {
            return false; // Sudah dikirim
        }

        // 2. Jika belum, ambil event
        let query = '';
        if (eventScope === 'today') {
            query = 'SELECT * FROM schedules WHERE schedule_date = ?';
        } else {
            query = 'SELECT * FROM schedules WHERE schedule_date = ?';
        }

        const [events] = await connection.query(query, [dateStr]);

        if (events.length === 0) {
            // Tidak ada event, tetap catat log supaya tidak cek terus-menerus
            await connection.query(
                'INSERT INTO notification_logs (notification_type, target_date, status, message) VALUES (?, ?, ?, ?)',
                [type, dateStr, 'SKIPPED', 'No events found']
            );
            return false;
        }

        // 3. Kirim Notifikasi (Blast)
        // Gunakan endpoint push-email dan push-whatsapp yang sudah ada, atau panggil logic-nya langsung.
        // Untuk efisiensi dan reusability, kita panggil helper langsung jika memungkinkan, 
        // tapi karena kita di route handler, kita bisa fetch ke localhost atau import logic.
        // DISINI kita akan hit endpoint internal agar logic blast terisolasi.

        // Namun fetch ke localhost di serverless kadang tricky. Lebih aman copy logic blast sederhana atau import helper.
        // Kita anggap "trigger blast" sukses jika kita iterasi event.

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

        // Kita kirim parallel per event
        const promises = events.map(async (ev) => {
            // Send Email
            try {
                await fetch(`${baseUrl}/api/push-email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventId: ev.id, notifType: 'SCHEDULED_' + type })
                });
            } catch (e) { console.error('Email fail', e); }

            // Send WhatsApp
            try {
                await fetch(`${baseUrl}/api/push-whatsapp`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ eventId: ev.id, notifType: 'SCHEDULED_' + type })
                });
            } catch (e) { console.error('WA fail', e); }
        });

        await Promise.allSettled(promises);

        // 4. Catat Log Sukses
        await connection.query(
            'INSERT INTO notification_logs (notification_type, target_date, status, message) VALUES (?, ?, ?, ?)',
            [type, dateStr, 'SUCCESS', `Sent for ${events.length} events`]
        );

        return true;

    } catch (err) {
        console.error(`Error processing ${type}:`, err);
        return false;
    } finally {
        if (connection) connection.release();
    }
}
