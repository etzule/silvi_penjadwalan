import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import db from "@/lib/db";
import { sendResendEmail } from "@/lib/resend";
import { sendMail } from "@/lib/mailer";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Jakarta");

function safeParseJsonArray(input) {
    try {
        if (!input) return [];
        if (Array.isArray(input)) return input.map((x) => String(x));
        if (typeof input === "string") {
            const parsed = JSON.parse(input);
            return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
        }
        return [];
    } catch (e) {
        return [];
    }
}

async function ensureDedupeTable() {
    try {
        await db.query(`
      CREATE TABLE IF NOT EXISTS email_notification_log (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        event_id BIGINT NOT NULL,
        notif_type VARCHAR(32) NOT NULL,
        notif_date VARCHAR(10) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uniq_event_type_date (event_id, notif_type, notif_date)
      )
    `);
    } catch (e) {
        // ignore
    }
}

async function tryReserveSend(eventId, notifType, notifDate) {
    await ensureDedupeTable();
    try {
        const [r] = await db.query(
            "INSERT IGNORE INTO email_notification_log (event_id, notif_type, notif_date) VALUES (?, ?, ?)",
            [eventId, notifType, notifDate]
        );
        return Boolean(r && r.affectedRows === 1);
    } catch (e) {
        return true;
    }
}

async function sendEmail({ to, subject, text, html }) {
    if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
        return sendResendEmail({ to, subject, text, html });
    }
    if (process.env.GMAIL_USER && process.env.GMAIL_PASS) {
        return sendMail({ to, subject, text, html });
    }
    throw new Error("Email provider not configured (RESEND_* or GMAIL_* missing)");
}

export async function sendInstantEmail({ eventId, notifType = "H-1", broadcastToAll = false }) {
    try {
        if (!eventId) {
            return { ok: false, error: "Missing eventId" };
        }

        const [rows] = await db.query(
            "SELECT s.*, u.full_name as creator_name, u.username as creator_username FROM schedules s LEFT JOIN users u ON s.creator_id = u.id WHERE s.id = ?",
            [eventId]
        );
        if (!rows || rows.length === 0) {
            return { ok: false, error: "Event not found" };
        }
        const ev = rows[0];

        let users = [];
        let targetRoles = [];

        if (broadcastToAll) {
            const [allUsers] = await db.query(
                `SELECT id, username, email, role FROM users WHERE email IS NOT NULL AND email != ""`
            );
            users = allUsers || [];
            targetRoles = safeParseJsonArray(ev.tujuan_jabatan)
                .map((r) => String(r).toLowerCase().trim())
                .filter(Boolean);
        } else {
            targetRoles = safeParseJsonArray(ev.tujuan_jabatan)
                .map((r) => String(r).toLowerCase().trim())
                .filter(Boolean);
            const targetRoleFallback = String(ev.target_role || "").toLowerCase().trim();
            if (targetRoleFallback && !targetRoles.includes(targetRoleFallback)) targetRoles.push(targetRoleFallback);

            const recipientIds = new Set();
            if (ev.creator_id) recipientIds.add(Number(ev.creator_id));

            if (targetRoles.length > 0) {
                const placeholders = targetRoles.map(() => "?").join(",");
                const [roleUsers] = await db.query(
                    `SELECT id FROM users WHERE LOWER(TRIM(role)) IN (${placeholders})`,
                    targetRoles
                );
                (roleUsers || []).forEach((u) => recipientIds.add(Number(u.id)));
            }

            if (recipientIds.size === 0) {
                return { ok: true, sent: 0, skipped: true, reason: "No recipients resolved" };
            }

            const ids = Array.from(recipientIds).filter((x) => Number.isFinite(x));
            const idPlaceholders = ids.map(() => "?").join(",");
            const [targetUsers] = await db.query(
                `SELECT id, username, email, role FROM users WHERE id IN (${idPlaceholders}) AND email IS NOT NULL AND email != ""`,
                ids
            );
            users = targetUsers || [];
        }

        if (!users || users.length === 0) {
            return { ok: true, sent: 0, skipped: true, reason: "Recipients have no email" };
        }

        const notifDate = dayjs().tz().format("YYYY-MM-DD");
        if (!broadcastToAll) {
            const shouldSend = await tryReserveSend(Number(eventId), notifType, notifDate);
            if (!shouldSend) {
                return { ok: true, deduped: true, sent: 0 };
            }
        }

        const when = ev.schedule_date ? dayjs(ev.schedule_date).format("DD MMMM YYYY") : "-";
        const timeStart = ev.schedule_time || "-";
        const timeEnd = ev.schedule_end_time || null;
        const timeRange = timeEnd ? `${timeStart} - ${timeEnd}` : timeStart;
        const location = ev.location || "-";
        const description = ev.description || "Tidak ada deskripsi";
        const targetRolesText = (targetRoles && targetRoles.length > 0 ? targetRoles.join(", ") : (ev.target_role || "-"));
        const creatorName = ev.creator_name || ev.creator_username || "Admin";

        const subject = `Pengingat Jadwal (${notifType}) — ${ev.title || "(tanpa judul)"}`;

        const text = `
PENGINGAT JADWAL (${notifType})

Judul Kegiatan: ${ev.title || "(tanpa judul)"}
Tanggal: ${when}
Waktu: ${timeRange}
Lokasi: ${location}
Ditujukan untuk: ${targetRolesText}
Dibuat oleh: ${creatorName}

Deskripsi:
${description}

---
Pesan ini dikirim secara otomatis oleh Sistem Penjadwalan Kegiatan Kelurahan.
    `.trim();

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }
    .container { max-width: 600px; margin: 20px auto; background: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; padding: 30px 20px; text-align: center; }
    .header h1 { margin: 0; font-size: 24px; font-weight: 600; }
    .badge { display: inline-block; background: rgba(255,255,255,0.2); padding: 5px 15px; border-radius: 20px; font-size: 12px; margin-top: 10px; }
    .content { padding: 30px 20px; }
    .event-title { font-size: 22px; font-weight: bold; color: #667eea; margin-bottom: 20px; }
    .detail-row { margin-bottom: 15px; padding: 12px; background: #f8f9fa; border-left: 4px solid #667eea; border-radius: 4px; }
    .detail-label { font-weight: bold; color: #555; font-size: 13px; text-transform: uppercase; margin-bottom: 5px; }
    .detail-value { color: #333; font-size: 15px; }
    .description-box { background: #fff9e6; border: 1px solid #ffe066; border-radius: 6px; padding: 15px; margin-top: 20px; }
    .description-box h3 { margin-top: 0; color: #d97706; font-size: 16px; }
    .footer { background: #f8f9fa; padding: 20px; text-align: center; font-size: 12px; color: #666; border-top: 1px solid #e0e0e0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>📅 Pengingat Jadwal Kegiatan</h1>
      <span class="badge">${notifType}</span>
    </div>
    <div class="content">
      <div class="event-title">${ev.title || "(tanpa judul)"}</div>
      <div class="detail-row"><div class="detail-label">📆 Tanggal</div><div class="detail-value">${when}</div></div>
      <div class="detail-row"><div class="detail-label">🕐 Waktu</div><div class="detail-value">${timeRange}</div></div>
      <div class="detail-row"><div class="detail-label">📍 Lokasi</div><div class="detail-value">${location}</div></div>
      <div class="detail-row"><div class="detail-label">👥 Ditujukan Untuk</div><div class="detail-value">${targetRolesText}</div></div>
      <div class="detail-row"><div class="detail-label">👤 Dibuat Oleh</div><div class="detail-value">${creatorName}</div></div>
      <div class="description-box">
        <h3>📋 Deskripsi Kegiatan</h3>
        <p style="margin: 0; white-space: pre-wrap;">${description}</p>
      </div>
    </div>
    <div class="footer">
      <p style="margin: 0;">Pesan ini dikirim secara otomatis oleh Sistem Penjadwalan Kegiatan Kelurahan.</p>
    </div>
  </div>
</body>
</html>
    `.trim();

        const settled = [];
        for (const u of users) {
            try {
                const r = await sendEmail({ to: u.email, subject, text, html });
                settled.push({ ok: true, email: u.email, result: r });
            } catch (e) {
                settled.push({ ok: false, email: u.email, error: String(e) });
            }
            await new Promise((res) => setTimeout(res, 250));
        }

        const sent = settled.filter((s) => s.ok).length;
        const failed = settled.filter((s) => !s.ok).length;

        return {
            ok: true,
            sent,
            failed,
            recipients: users.length,
            failures: settled.filter((s) => !s.ok).slice(0, 20),
        };
    } catch (err) {
        return { ok: false, error: String(err) };
    }
}
