import db from '../../../lib/db.js';
import { sendWhatsAppMessage, isWhatsAppConnected } from '../../../lib/whatsappBaileys.js';
import dayjs from 'dayjs';

/**
 * API Handler for WhatsApp Reminders
 * 
 * GET /api/reminder-whatsapp
 * - Triggered by cron or manual request
 * - Sends H-1 reminders to users with a WhatsApp number
 */
export async function GET(req) {
    try {
        // Check if WhatsApp is connected
        if (!isWhatsAppConnected()) {
            return new Response(JSON.stringify({
                ok: false,
                error: 'WhatsApp not connected. Please scan QR code first.',
                needsQR: true
            }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const today = dayjs();
        const besok = today.add(1, 'day').format('YYYY-MM-DD');

        // 1. Get users with whatsapp number
        console.log('[reminder-whatsapp] Getting users with whatsapp...');
        const [users] = await db.query('SELECT id, username, whatsapp, role FROM users WHERE whatsapp IS NOT NULL AND whatsapp != ""');
        console.log(`[reminder-whatsapp] Found ${users.length} users:`, users.map(u => u.username));

        if (!users || users.length === 0) {
            return new Response(JSON.stringify({ ok: true, message: 'No users with whatsapp found' }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const results = [];

        for (const user of users) {
            // 2. Get events for tomorrow that are relevant to this user
            console.log(`[reminder-whatsapp] Checking events for ${user.username} on ${besok}...`);

            // Get events where user is creator OR user's role matches target role
            const userRole = (user.role || '').toLowerCase().trim();
            const [events] = await db.query(
                `SELECT * FROM schedules 
                 WHERE schedule_date = ? 
                 AND (
                   creator_id = ? 
                   OR target_role = ?
                   OR JSON_CONTAINS(LOWER(tujuan_jabatan), JSON_QUOTE(?))
                 )`,
                [besok, user.id, userRole, userRole]
            );
            console.log(`[reminder-whatsapp] Found ${events.length} events for ${user.username}`);

            if (!events || events.length === 0) continue;

            // 3. Compose detailed message for each event
            for (const ev of events) {
                const timeStart = ev.schedule_time || '-';
                const timeEnd = ev.schedule_end_time || null;
                const timeRange = timeEnd ? `${timeStart} - ${timeEnd}` : timeStart;
                const location = ev.location || '-';
                const description = ev.description || 'Tidak ada deskripsi';
                const whenFormatted = dayjs(ev.schedule_date).format('DD MMMM YYYY');

                const message = `
📅 *PENGINGAT JADWAL (H-1)*

*${ev.title || '(tanpa judul)'}*

📆 *Tanggal:* ${whenFormatted}
🕐 *Waktu:* ${timeRange}
📍 *Lokasi:* ${location}

📋 *Deskripsi:*
${description}

---
_Pesan ini dikirim secara otomatis oleh Sistem Penjadwalan Kegiatan Kelurahan._
                `.trim();

                // 4. Send message
                try {
                    const res = await sendWhatsAppMessage(user.whatsapp, message);
                    results.push({
                        user: user.username,
                        event: ev.title,
                        status: 'sent',
                        res
                    });
                } catch (err) {
                    console.error(`Failed to send WhatsApp to ${user.username} (${user.whatsapp}):`, err);
                    results.push({
                        user: user.username,
                        event: ev.title,
                        status: 'failed',
                        error: String(err)
                    });
                }

                // Delay between messages to avoid rate limiting
                await new Promise(r => setTimeout(r, 1000));
            }
        }

        return new Response(JSON.stringify({ ok: true, results }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error) {
        console.error('[reminder-whatsapp] Error:', error);
        return new Response(JSON.stringify({ ok: false, error: String(error) }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// POST method for testing or ad-hoc messages
export async function POST(req) {
    try {
        // Check if WhatsApp is connected
        if (!isWhatsAppConnected()) {
            return new Response(JSON.stringify({
                ok: false,
                error: 'WhatsApp not connected. Please scan QR code first.',
                needsQR: true
            }), {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const body = await req.json();
        const { to, text } = body;

        if (!to || !text) {
            return new Response(JSON.stringify({ ok: false, error: 'Missing to or text' }), { status: 400 });
        }

        const res = await sendWhatsAppMessage(to, text);
        return new Response(JSON.stringify({ ok: true, result: res }), { status: 200 });
    } catch (error) {
        return new Response(JSON.stringify({ ok: false, error: String(error) }), { status: 500 });
    }
}
