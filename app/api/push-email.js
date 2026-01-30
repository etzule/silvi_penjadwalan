import db from '../../lib/db.js';
import { sendResendEmail } from '../../lib/resend.js';
import dayjs from 'dayjs';

export async function POST(req) {
  try {
    const { eventId } = await req.json();
    if (!eventId) return new Response(JSON.stringify({ error: 'Missing eventId' }), { status: 400 });
    // Get event detail
    const [rows] = await db.query('SELECT * FROM schedules WHERE id = ?', [eventId]);
    if (!rows.length) return new Response(JSON.stringify({ error: 'Event not found' }), { status: 404 });
    const ev = rows[0];
    // Get all users with email
    const [users] = await db.query('SELECT id, username, email FROM users WHERE email IS NOT NULL AND email != ""');
    if (!users.length) return new Response(JSON.stringify({ error: 'No users with email' }), { status: 404 });
    // Compose email
    let html = `<h3>Pengingat Kegiatan Sekarang (${dayjs().format('YYYY-MM-DD HH:mm')})</h3><ul>`;
    html += `<li><b>${ev.title || '(tanpa judul)'}</b> jam ${ev.schedule_time || '-'}<br>${ev.description || ''}</li>`;
    html += '</ul>';
    // Send to all users
    for (const user of users) {
      await sendResendEmail({
        to: user.email,
        subject: 'Pengingat Jadwal Kegiatan Sekarang',
        text: 'Ada kegiatan yang sedang berlangsung. Silakan cek aplikasi.',
        html,
      });
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
}
