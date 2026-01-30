import { NextResponse } from "next/server";
import db from "@/lib/db";
import * as cookie from 'cookie';
import jwt from 'jsonwebtoken';
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.tz.setDefault("Asia/Jakarta");

import { sendInstantEmail } from "@/lib/notification";
import { sendInstantWhatsApp } from "@/lib/whatsapp-notification";

// GET semua jadwal
export async function GET() {
  const [rows] = await db.query(
    "SELECT s.*, u.username AS creator_username, u.full_name AS creator_full_name, u.role AS creator_role FROM schedules s LEFT JOIN users u ON s.creator_id = u.id ORDER BY s.schedule_date, s.schedule_time"
  );
  return NextResponse.json(rows);
}

// POST tambah jadwal
export async function POST(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = cookie.parse(cookieHeader || '');
  const token = cookies.token;

  // Allow unauthenticated posting if no token? currently require token:
  if (!token) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401 });
  }

  const body = await req.json();
  const { title, description, location, schedule_date, schedule_time, schedule_end_time } = body;

  // Validate time range if both times are provided
  if (schedule_time && schedule_end_time) {
    const timeToMinutes = (time) => {
      const [h, m] = time.split(':').map(Number);
      return h * 60 + m;
    };

    if (timeToMinutes(schedule_end_time) <= timeToMinutes(schedule_time)) {
      return new Response(JSON.stringify({
        error: 'Invalid time range',
        message: 'Waktu selesai harus lebih besar dari waktu mulai'
      }), { status: 400 });
    }
  }

  // Normalize & validate target_role (bisa string atau array of string)
  let tr = null;
  // kolom tujuan_jabatan bertipe JSON: default ke array kosong
  let tujuanJabatan = '[]';

  if (Array.isArray(body.target_role)) {
    const normalized = body.target_role
      .map((r) => String(r).trim())
      .filter((r) => r.length > 0);

    // kolom target_role di DB kemungkinan bertipe ENUM / pendek,
    // jadi simpan HANYA satu nilai yang valid (pertama) agar tidak error.
    tr = normalized.length > 0 ? normalized[0] : null;
    // simpan SEMUA jabatan yang valid sebagai JSON array di kolom tujuan_jabatan
    tujuanJabatan = JSON.stringify(normalized);
  } else if (typeof body.target_role === 'string') {
    const r = body.target_role.trim();
    if (r.length > 0) {
      tr = r;
      tujuanJabatan = JSON.stringify([r]);
    }
  }

  console.log('Creating schedule with tujuanJabatan:', tujuanJabatan);

  // Determine effective Creator ID - Defined HERE to be accessible in both conflict check AND Insert
  let userId = payload.id;
  let userRole = payload.role;

  // ADMIN OVERRIDE: If admin provides creator_id
  if (payload.role === 'admin' && body.creator_id) {
    userId = Number(body.creator_id);
    console.log(`[POST] Admin overrides creator_id to: ${userId}`);
  }

  // Check for schedule conflict: overlapping time ranges for the same target role
  if (schedule_time) {
    // Helper function to check if two time ranges overlap
    const checkTimeRangeOverlap = (start1, end1, start2, end2) => {
      const timeToMinutes = (time) => {
        if (!time) return null;
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
      };

      const s1 = timeToMinutes(start1);
      const e1 = end1 ? timeToMinutes(end1) : s1;
      const s2 = timeToMinutes(start2);
      const e2 = end2 ? timeToMinutes(end2) : s2;

      if (s1 === null || s2 === null) return false;

      // Two ranges overlap if: (start1 <= end2) AND (end1 >= start2)
      // Using <= and >= to include exact time matches
      return (s1 <= e2) && (e1 >= s2);
    };

    // Helper function to check if two target role arrays have any overlap
    const checkTargetRoleOverlap = (roles1, roles2) => {
      if (!roles1 || !roles2) return false;

      try {
        // Parse JSON strings to arrays if needed
        const arr1 = typeof roles1 === 'string' ? JSON.parse(roles1) : roles1;
        const arr2 = typeof roles2 === 'string' ? JSON.parse(roles2) : roles2;

        // Ensure both are arrays
        if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;

        // Check if there's any common role between the two arrays
        const hasOverlap = arr1.some(role => arr2.includes(role));
        console.log('Checking role overlap:', arr1, 'vs', arr2, '=', hasOverlap);
        return hasOverlap;
      } catch (e) {
        console.error('Error parsing roles:', e);
        return false;
      }
    };

    // Get all events on the same date with their creators and roles
    const [existingRows] = await db.query(
      'SELECT s.id, s.title, s.schedule_time, s.schedule_end_time, s.creator_id, s.tujuan_jabatan, u.role as creator_role FROM schedules s LEFT JOIN users u ON s.creator_id = u.id WHERE s.schedule_date = ?',
      [schedule_date]
    );

    console.log('Existing schedules on', schedule_date, ':', existingRows.length);

    console.log('Existing schedules on', schedule_date, ':', existingRows.length);

    // (userId and userRole already determined above)

    console.log('=== CONFLICT CHECK START ===');
    console.log('Effective User ID:', userId, '| Admin:', payload.username, '| Role (Admin):', payload.role);
    console.log('New schedule - Time:', schedule_time, '| End:', schedule_end_time, '| Roles:', tujuanJabatan);

    // Check for overlap with any existing event created by the SAME user
    const conflict = existingRows.find(row => {
      console.log('\n--- Checking against existing schedule ---');
      console.log('Existing schedule ID:', row.id, '| Title:', row.title);
      console.log('Existing creator_id:', row.creator_id, '| Role:', row.creator_role, '| Time:', row.schedule_time);

      // First check if time ranges overlap
      const timeOverlap = checkTimeRangeOverlap(
        schedule_time,
        schedule_end_time,
        row.schedule_time,
        row.schedule_end_time
      );

      console.log('Time overlap check:', schedule_time, 'vs', row.schedule_time, '=', timeOverlap);

      // If time doesn't overlap, no conflict
      if (!timeOverlap) return false;

      // If time overlaps, check for role conflict
      // 1. Same Creator (User ID matches) -> Conflict (Logic: One person can't be in 2 places)
      // 2. Same Role (Creator Role matches User Role) -> Conflict (Logic: Different people in same role clash as per request)

      const sameCreator = row.creator_id === userId;
      const sameRole = row.creator_role === userRole;

      console.log('Same creator:', sameCreator, '| Same role:', sameRole);

      // If it's the same creator OR same role, it is a conflict
      // Note: We are now strict. Even if target roles differ, if the creator role is the same, it blocks.
      // This satisfies: "jika orang berbeda namun di jabatan yang sama membuat kegiatan pada jam yang sama" -> Block.
      if (!sameCreator) return false;
      return checkTargetRoleOverlap(tujuanJabatan, row.tujuan_jabatan);

      return false;
    });

    console.log('\n=== CONFLICT CHECK RESULT ===');
    console.log('Conflict found:', conflict ? 'YES' : 'NO');
    if (conflict) {
      console.log('Conflicting schedule:', conflict.title, '| ID:', conflict.id);
    }
    console.log('=== END CONFLICT CHECK ===\n');

    if (conflict) {
      const conflictTimeRange = conflict.schedule_end_time
        ? `${conflict.schedule_time} - ${conflict.schedule_end_time}`
        : conflict.schedule_time;

      console.log('CONFLICT DETECTED:', conflict.title);

      return new Response(JSON.stringify({
        error: 'Jadwal bentrok',
        message: `Anda sudah memiliki jadwal "${conflict.title}" pada waktu ${conflictTimeRange}. Silakan pilih waktu lain.`,
        conflict: true
      }), { status: 409 }); // 409 Conflict
    }
  }

  // Try INSERT with creator_id, target_role, tujuan_jabatan, schedule_end_time, location (preferred)
  const sqlWithCreator =
    'INSERT INTO schedules (title, description, location, schedule_date, schedule_time, schedule_end_time, creator_id, target_role, tujuan_jabatan) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';

  try {
    const [result] = await db.query(sqlWithCreator, [
      title,
      description,
      location || null,
      schedule_date,
      schedule_time,
      schedule_end_time,
      userId, // Use effective ID (Admin override or Payload ID)
      tr,
      tujuanJabatan,
    ]);

    const newEventId = result.insertId;

    // Check if event is TODAY or TOMORROW
    const today = dayjs().tz().format('YYYY-MM-DD');
    const tomorrow = dayjs().tz().add(1, 'day').format('YYYY-MM-DD');
    const isSameDay = schedule_date === today;
    const isTomorrow = schedule_date === tomorrow;

    if (isSameDay || isTomorrow) {
      const notifType = isSameDay ? 'INSTANT' : 'H-1 (NEW)';
      console.log(`[Schedule API] Event created for ${isSameDay ? 'TODAY' : 'TOMORROW'}! Sending instant notifications for event ${newEventId}`);

      // Send instant notifications (non-blocking, fire and forget)
      // Email notification (Direct call)
      sendInstantEmail({ eventId: newEventId, notifType })
        .then(res => console.log('[Schedule API] Instant email result:', res))
        .catch(err => console.error('[Schedule API] Failed to send instant email:', err));

      // WhatsApp notification (Direct call)
      sendInstantWhatsApp({ eventId: newEventId, notifType })
        .then(res => console.log('[Schedule API] Instant WhatsApp result:', res))
        .catch(err => console.error('[Schedule API] Failed to send instant WhatsApp:', err));
    }

    return new Response(JSON.stringify({ ok: true }), { status: 201 });
  } catch (err) {
    // If error indicates unknown column (table doesn't have creator_id/target_role), fallback
    // mysql2 error code for unknown column is ER_BAD_FIELD_ERROR (code: 'ER_BAD_FIELD_ERROR')
    // But generic runtime errors may have different shapes; we'll fallback on that specific code or on message includes.
    const shouldFallback =
      err && (err.code === 'ER_BAD_FIELD_ERROR' || (err.message && /Unknown column/i.test(err.message)));

    if (!shouldFallback) {
      console.error('Failed to insert schedule (primary):', err);
      return new Response(JSON.stringify({ error: 'Failed to save schedule', detail: err.message || String(err) }), { status: 500 });
    }

    // Fallback: insert without creator_id/target_role (older schema)
    const sqlFallback = 'INSERT INTO schedules (title, description, schedule_date, schedule_time) VALUES (?, ?, ?, ?)';
    try {
      await db.query(sqlFallback, [title, description, schedule_date, schedule_time]);
      return new Response(JSON.stringify({ ok: true, fallback: true }), { status: 201 });
    } catch (err2) {
      console.error('Failed to insert schedule (fallback):', err2);
      return new Response(JSON.stringify({ error: 'Failed to save schedule (fallback)', detail: err2.message || String(err2) }), { status: 500 });
    }
  }
}


// PUT update jadwal (admin only)
export async function PUT(req) {
  try {
    // Check authentication
    const cookieHeader = req.headers.get('cookie') || '';
    const cookies = cookie.parse(cookieHeader || '');
    const token = cookies.token;

    if (!token) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    // Check if user is admin
    if (payload.role !== 'admin') {
      return NextResponse.json({
        success: false,
        message: "Akses ditolak. Hanya admin yang dapat mengedit jadwal."
      }, { status: 403 });
    }

    const body = await req.json();
    const { id, title, description, location, schedule_date, schedule_time, schedule_end_time, target_role } = body;

    if (!id) {
      return NextResponse.json({ success: false, message: "ID is required" }, { status: 400 });
    }

    // Validate time range if both times are provided
    if (schedule_time && schedule_end_time) {
      const timeToMinutes = (time) => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
      };

      if (timeToMinutes(schedule_end_time) <= timeToMinutes(schedule_time)) {
        return new Response(JSON.stringify({
          error: 'Invalid time range',
          message: 'Waktu selesai harus lebih besar dari waktu mulai'
        }), { status: 400 });
      }
    }

    // Normalize & validate target_role
    let tr = null;
    let tujuanJabatan = '[]';

    if (Array.isArray(target_role)) {
      const normalized = target_role
        .map((r) => String(r).trim())
        .filter((r) => r.length > 0);
      tr = normalized.length > 0 ? normalized[0] : null;
      tujuanJabatan = JSON.stringify(normalized);
    } else if (typeof target_role === 'string') {
      const r = target_role.trim();
      if (r.length > 0) {
        tr = r;
        tujuanJabatan = JSON.stringify([r]);
      }
    }

    // Check for schedule conflict (exclude current event)
    if (schedule_time) {
      // ... (existing conflict check logic kept same, see below block for brevity if strictly needed, but I will include essential parts)
      const checkTimeRangeOverlap = (start1, end1, start2, end2) => {
        const timeToMinutes = (time) => {
          if (!time) return null;
          const [h, m] = time.split(':').map(Number);
          return h * 60 + m;
        };

        const s1 = timeToMinutes(start1);
        const e1 = end1 ? timeToMinutes(end1) : s1;
        const s2 = timeToMinutes(start2);
        const e2 = end2 ? timeToMinutes(end2) : s2;

        if (s1 === null || s2 === null) return false;

        return (s1 <= e2) && (e1 >= s2);
      };

      const checkTargetRoleOverlap = (roles1, roles2) => {
        if (!roles1 || !roles2) return false;
        try {
          const arr1 = typeof roles1 === 'string' ? JSON.parse(roles1) : roles1;
          const arr2 = typeof roles2 === 'string' ? JSON.parse(roles2) : roles2;
          if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
          return arr1.some(role => arr2.includes(role));
        } catch (e) {
          return false;
        }
      };

      const [existingRows] = await db.query(
        'SELECT s.id, s.title, s.schedule_time, s.schedule_end_time, s.creator_id, s.tujuan_jabatan, u.role as creator_role FROM schedules s LEFT JOIN users u ON s.creator_id = u.id WHERE s.schedule_date = ? AND s.id != ?',
        [schedule_date, id]
      );

      const [currentSchedule] = await db.query(
        'SELECT creator_id FROM schedules WHERE id = ?',
        [id]
      );
      // We don't necessarily need currentCreatorId logic anymore if we rely on role, 
      // but for PUT, we assume the editor is an Admin (as per line 292 checks).
      // Wait, line 292 checks if payload.role !== 'admin' -> reject.
      // So ONLY ADMINS can edit.
      // If an Admin edits a schedule created by a Lurah?
      // The conflict check should probably respect the ORIGINAL CREATOR's role or the ADMIN's role?
      // "client ingin... jika orang berbeda namun di jabatan yang sama".
      // Usually, if Admin edits, they are managing *the schedule*.
      // If Admin changes the time of a Lurah event to clash with a Sekretaris event...
      // The 'creator_role' of the *other* event is Sekretaris.
      // The 'creator_role' of *this* event (being edited) is... well, stored in DB.
      // We should probably check the Role of the User *who created the event being edited*, OR the role of the Editor?
      // Since `PUT` is Admin only:
      // If Admin schedules "Rapat Lurah" (created by Admin) overlapping with "Rapat Lurah" (created by Admin).
      // They are Same Role (Admin).
      // If Admin schedules "Rapat Lurah" overlapping with "Rapat Sekretaris".
      // If we strictly check "Same Role", Admin vs Admin clashes.
      // This seems consistent.

      const userRole = payload.role;

      const conflict = existingRows.find(row => {
        const timeOverlap = checkTimeRangeOverlap(
          schedule_time,
          schedule_end_time,
          row.schedule_time,
          row.schedule_end_time
        );
        if (!timeOverlap) return false;

        // Strict Role Check
        const sameCreator = row.creator_id === payload.id; // Comparing against Editor (Admin)
        const sameRole = row.creator_role === userRole;    // Comparing against Editor Role (Admin)

        // If Admin is editing, and conflicts with another Admin's event -> Conflict.
        // If Admin is editing, and conflicts with Lurah's event -> Admin != Lurah -> No Conflict.
        // This seems safe.

        if (!sameCreator) return false;
        return checkTargetRoleOverlap(tujuanJabatan, row.tujuan_jabatan);
        return false;
      });

      if (conflict) {
        const conflictTimeRange = conflict.schedule_end_time
          ? `${conflict.schedule_time} - ${conflict.schedule_end_time}`
          : conflict.schedule_time;
        return new Response(JSON.stringify({
          error: 'Jadwal bentrok',
          message: `Anda sudah memiliki jadwal "${conflict.title}" pada waktu ${conflictTimeRange}. Silakan pilih waktu lain.`,
          conflict: true
        }), { status: 409 });
      }
    }

    // --- LOGGING START ---
    // Fetch old data before update
    const [oldRows] = await db.query("SELECT * FROM schedules WHERE id = ?", [id]);
    const oldData = oldRows[0] || {};
    // --- LOGGING END ---

    // Update schedule
    await db.query(
      'UPDATE schedules SET title = ?, description = ?, location = ?, schedule_date = ?, schedule_time = ?, schedule_end_time = ?, target_role = ?, tujuan_jabatan = ? WHERE id = ?',
      [title, description, location || null, schedule_date, schedule_time, schedule_end_time, tr, tujuanJabatan, id]
    );

    // --- LOGGING INSERT ---
    try {
      const changedFields = [];
      if (oldData.title !== title) changedFields.push('Judul');
      if (oldData.description !== description) changedFields.push('Deskripsi');
      if (oldData.schedule_date !== schedule_date) changedFields.push('Tanggal');
      if (oldData.schedule_time !== schedule_time) changedFields.push('Waktu Mulai');
      if (oldData.schedule_end_time !== schedule_end_time) changedFields.push('Waktu Selesai');
      if (oldData.location !== location) changedFields.push('Lokasi');
      // Simple check for roles change
      if (oldData.tujuan_jabatan !== tujuanJabatan) changedFields.push('Target Jabatan');

      if (changedFields.length > 0) {
        await db.query(
          "INSERT INTO schedule_logs (schedule_id, action_type, old_data, new_data, changed_fields, editor_id, editor_name) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            id,
            'UPDATE',
            JSON.stringify(oldData),
            JSON.stringify({ ...body, tujuanJabatan }),
            changedFields.join(', '),
            payload.id,
            payload.username
          ]
        );
      }
    } catch (logErr) {
      console.error('Failed to write audit log:', logErr);
      // Proceed without failing the request
    }
    // --- LOGGING END ---

    // --- NOTIFICATION TRIGGER START ---
    const today = dayjs().tz().format('YYYY-MM-DD');
    const tomorrow = dayjs().tz().add(1, 'day').format('YYYY-MM-DD');
    const isToday = schedule_date === today;
    const isTomorrow = schedule_date === tomorrow;

    if (isToday || isTomorrow) {
      const notifType = isToday ? 'INSTANT' : 'H-1 (UPDATE)';
      console.log(`[Schedule API] Event updated to ${isToday ? 'TODAY' : 'TOMORROW'}! Sending instant notifications for event ${id}`);

      // Send instant notifications (non-blocking)
      sendInstantEmail({ eventId: id, notifType })
        .then(res => console.log('[Schedule API] Instant email (update) result:', res))
        .catch(err => console.error('[Schedule API] Failed to send instant email (update):', err));

      sendInstantWhatsApp({ eventId: id, notifType })
        .then(res => console.log('[Schedule API] Instant WhatsApp (update) result:', res))
        .catch(err => console.error('[Schedule API] Failed to send instant WhatsApp (update):', err));
    }
    // --- NOTIFICATION TRIGGER END ---

    return NextResponse.json({ success: true, message: "Jadwal berhasil diupdate" });
  } catch (err) {
    console.error('Error updating schedule:', err);
    return NextResponse.json({ success: false, message: "Gagal update jadwal", error: err.message }, { status: 500 });
  }
}

// DELETE hapus jadwal berdasarkan id (dikirim di body sebagai JSON { id })
export async function DELETE(req) {
  try {
    // Check authentication
    const cookieHeader = req.headers.get('cookie') || '';
    const cookies = cookie.parse(cookieHeader || '');
    const token = cookies.token;

    if (!token) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
      return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
    }

    // Check if user is admin - only admin can delete schedules
    if (payload.role !== 'admin') {
      return NextResponse.json({
        success: false,
        message: "Akses ditolak. Hanya admin yang dapat menghapus jadwal."
      }, { status: 403 });
    }

    const body = await req.json();
    const id = body.id;

    if (!id) {
      return NextResponse.json({ success: false, message: "id is required" }, { status: 400 });
    }

    // --- LOGGING START ---
    const [oldRows] = await db.query("SELECT * FROM schedules WHERE id = ?", [id]);
    const oldData = oldRows[0] || {};
    // --- LOGGING END ---

    await db.query("DELETE FROM schedules WHERE id = ?", [id]);

    // --- LOGGING INSERT ---
    try {
      if (oldData.id) {
        await db.query(
          "INSERT INTO schedule_logs (schedule_id, action_type, old_data, new_data, changed_fields, editor_id, editor_name) VALUES (?, ?, ?, ?, ?, ?, ?)",
          [
            id,
            'DELETE',
            JSON.stringify(oldData),
            null,
            'Jadwal Dihapus',
            payload.id,
            payload.username
          ]
        );
      }
    } catch (logErr) {
      console.error('Failed to write audit log for delete:', logErr);
    }
    // --- LOGGING END ---

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}