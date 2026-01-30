import db from '../../../lib/db.js';
import { sendResendEmail } from '../../../lib/resend.js';
import { sendMail } from '../../../lib/mailer.js';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Jakarta");

// Next.js App Router route handler for /api/reminder-email
export async function GET(req) {
  const todayDate = dayjs().tz();
  const todayStr = todayDate.format('YYYY-MM-DD');
  const besokDate = todayDate.add(1, 'day');
  const besokStr = besokDate.format('YYYY-MM-DD');

  // Get all users with email
  const [users] = await db.query('SELECT id, username, email FROM users WHERE email IS NOT NULL AND email != ""');

  for (const user of users) {
    // Get events for this user (Today AND Tomorrow)
    const [events] = await db.query(
      'SELECT * FROM schedules WHERE (creator_id = ? OR target_role IS NOT NULL) AND schedule_date IN (?, ?)',
      [user.id, todayStr, besokStr]
    );

    if (!events.length) continue;

    // Separate events
    const todayEvents = events.filter(e => dayjs(e.schedule_date).format('YYYY-MM-DD') === todayStr);
    const besokEvents = events.filter(e => dayjs(e.schedule_date).format('YYYY-MM-DD') === besokStr);

    if (todayEvents.length === 0 && besokEvents.length === 0) continue;

    // Compose email
    let html = `<h3>Pengingat Jadwal Kegiatan</h3>`;

    if (todayEvents.length > 0) {
      html += `<h4>Hari Ini (${todayStr})</h4><ul>`;
      for (const ev of todayEvents) {
        html += `<li><b>${ev.title || '(tanpa judul)'}</b> jam ${ev.schedule_time || '-'}<br>${ev.description || ''}</li>`;
      }
      html += `</ul>`;
    }

    if (besokEvents.length > 0) {
      html += `<h4>Besok (${besokStr})</h4><ul>`;
      for (const ev of besokEvents) {
        html += `<li><b>${ev.title || '(tanpa judul)'}</b> jam ${ev.schedule_time || '-'}<br>${ev.description || ''}</li>`;
      }
      html += `</ul>`;
    }

    await sendResendEmail({
      to: user.email,
      subject: 'Pengingat Jadwal Kegiatan',
      text: 'Ada kegiatan penting untuk hari ini atau besok. Silakan cek aplikasi.',
      html,
    });
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export async function POST(req) {
  try {
    console.log('[reminder-email] POST received');
    const body = await req.json().catch(() => ({}));
    const { subject = 'Reminder', text = 'Ini adalah pengingat dari aplikasi penjadwalan.', html } = body || {};

    // quick env checks
    if (!process.env.RESEND_API_KEY) {
      console.error('[reminder-email] Missing RESEND_API_KEY');
      return new Response(JSON.stringify({ success: false, error: 'Server misconfiguration: RESEND_API_KEY missing' }), { status: 500 });
    }
    if (!process.env.RESEND_FROM_EMAIL) {
      console.error('[reminder-email] Missing RESEND_FROM_EMAIL');
      return new Response(JSON.stringify({ success: false, error: 'Server misconfiguration: RESEND_FROM_EMAIL missing' }), { status: 500 });
    }

    // Fetch all registered users with emails from database
    const [users] = await db.query('SELECT id, username, email FROM users WHERE email IS NOT NULL AND email != ""');
    if (!users || users.length === 0) {
      console.warn('[reminder-email] No users with email found in database');
      return new Response(JSON.stringify({ success: false, error: 'No users with email found' }), { status: 404 });
    }

    console.log(`[reminder-email] Sending email to ${users.length} users, subject=${subject}`);


    // Sequentially send emails with delay to avoid rate limit
    const settled = [];
    for (const u of users) {
      try {
        const r = await sendResendEmail({
          to: u.email,
          subject,
          text,
          html: html || `<p>${text}</p>`,
        });
        settled.push({ ok: true, email: u.email, result: r, provider: 'resend' });
      } catch (err) {
        console.warn('[reminder-email] Resend failed for', u.email, String(err));
        // attempt Gmail (nodemailer) fallback if credentials present
        if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
          try {
            const r2 = await sendMail({ to: u.email, subject, text, html: html || `<p>${text}</p>` });
            settled.push({ ok: true, email: u.email, result: r2, provider: 'gmail' });
          } catch (err2) {
            console.error('[reminder-email] Gmail fallback failed for', u.email, String(err2));
            settled.push({ ok: false, email: u.email, error: String(err2) });
          }
        } else {
          settled.push({ ok: false, email: u.email, error: String(err) });
        }
      }
      // Wait 600ms before next email to avoid Resend rate limit
      await new Promise((res) => setTimeout(res, 600));
    }

    const successes = settled.filter((s) => s.ok);
    const failures = settled.filter((s) => !s.ok);

    console.log(`[reminder-email] Sent: ${successes.length}, Failed: ${failures.length}`);
    // Log details for each success (message id or returned object) to help troubleshooting
    successes.forEach((s) => console.log('[reminder-email] success ->', s.email, s.result));
    failures.forEach((f) => console.error('[reminder-email] failure ->', f.email, f.error));

    return new Response(
      JSON.stringify({ success: true, sent: successes.length, failed: failures.length, failures: failures.slice(0, 20), successes: successes.slice(0, 20) }),
      { status: 200 }
    );
  } catch (error) {
    console.error('[reminder-email] Error in POST:', error);
    return new Response(JSON.stringify({ success: false, error: String(error) }), { status: 500 });
  }
}
