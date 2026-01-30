import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import db from "@/lib/db";
import { sendWhatsAppMessage, isWhatsAppConnected } from "@/lib/whatsappBaileys";

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
      CREATE TABLE IF NOT EXISTS whatsapp_notification_log (
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
            "INSERT IGNORE INTO whatsapp_notification_log (event_id, notif_type, notif_date) VALUES (?, ?, ?)",
            [eventId, notifType, notifDate]
        );
        return Boolean(r && r.affectedRows === 1);
    } catch (e) {
        return true;
    }
}

export async function sendInstantWhatsApp({ eventId, notifType = "H-1", broadcastToAll = false }) {
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

        // ... (existing user selection logic logic same until variable construction) ...

        if (broadcastToAll) {
            const [allUsers] = await db.query(
                `SELECT id, username, email, role, whatsapp FROM users WHERE whatsapp IS NOT NULL AND whatsapp != ""`
            );
            users = allUsers || [];
            targetRoles = safeParseJsonArray(ev.tujuan_jabatan)
                .map((r) => String(r).toLowerCase().trim())
                .filter(Boolean);
        } else {
            // Re-implement the extraction logic to be safe since we are replacing a large chunk or just use careful replacement
            // Ideally we shouldn't replace the whole middle logic if not needed.
            // But 'ev' was redefined above so it's fine.
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
                `SELECT id, username, email, role, whatsapp FROM users WHERE id IN (${idPlaceholders}) AND whatsapp IS NOT NULL AND whatsapp != ""`,
                ids
            );
            users = targetUsers || [];
        }

        if (!users || users.length === 0) {
            return { ok: true, sent: 0, skipped: true, reason: "Recipients have no whatsapp" };
        }

        const notifDate = dayjs().tz().format("YYYY-MM-DD");
        if (!broadcastToAll) {
            const shouldSend = await tryReserveSend(Number(eventId), notifType, notifDate);
            if (!shouldSend) {
                console.log(`[Push-WhatsApp] Message deduplicated for event ${eventId} on ${notifDate} (${notifType})`);
                return { ok: true, deduped: true, sent: 0, message: 'Already sent today' };
            }
        }

        let retries = 0;
        const maxRetries = 3;
        const retryDelay = 5000;

        while (!isWhatsAppConnected() && retries < maxRetries) {
            console.log(`[Push-WhatsApp] Waiting for WhatsApp connection... (attempt ${retries + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            retries++;
        }

        if (!isWhatsAppConnected()) {
            return {
                ok: false,
                error: "WhatsApp not connected after waiting. Please check connection.",
                needsQR: true,
                status: 503
            };
        }

        const when = ev.schedule_date ? dayjs(ev.schedule_date).format("DD MMMM YYYY") : "-";
        const timeStart = ev.schedule_time || "-";
        const timeEnd = ev.schedule_end_time || null;
        const timeRange = timeEnd ? `${timeStart} - ${timeEnd}` : timeStart;
        const location = ev.location || "-";
        const description = ev.description || "Tidak ada deskripsi";
        const targetRolesText = (targetRoles && targetRoles.length > 0 ? targetRoles.join(", ") : (ev.target_role || "-"));
        const creatorName = ev.creator_name || ev.creator_username || "Admin";

        const textBody = `
📅 *PENGINGAT JADWAL (${notifType})*

*${ev.title || "(tanpa judul)"}*

📆 *Tanggal:* ${when}
🕐 *Waktu:* ${timeRange}
📍 *Lokasi:* ${location}
👥 *Ditujukan untuk:* ${targetRolesText}
👤 *Dibuat oleh:* ${creatorName}

📋 *Deskripsi:*
${description}

---
_Pesan ini dikirim secara otomatis oleh Sistem Penjadwalan Kegiatan Kelurahan._
    `.trim();

        const settled = [];
        for (const u of users) {
            try {
                const to = String(u.whatsapp).trim();
                const r = await sendWhatsAppMessage(to, textBody);
                settled.push({ ok: true, whatsapp: to, result: r });
            } catch (e) {
                settled.push({ ok: false, whatsapp: u.whatsapp, error: String(e) });
            }
            await new Promise((res) => setTimeout(res, 1000));
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
