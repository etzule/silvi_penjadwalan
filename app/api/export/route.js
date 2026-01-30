import db from '../../../lib/db.js';
import ExcelJS from 'exceljs';

export async function GET(req) {
    const url = new URL(req.url);
    const month = parseInt(url.searchParams.get('month'));
    const year = parseInt(url.searchParams.get('year'));
    if (!month || !year) {
        return new Response('Missing month or year', { status: 400 });
    }

    // Query events for the month
    const [events] = await db.query(
        'SELECT s.*, u.username AS creator_username, u.full_name AS creator_full_name, u.role AS creator_role FROM schedules s LEFT JOIN users u ON s.creator_id = u.id WHERE MONTH(s.schedule_date) = ? AND YEAR(s.schedule_date) = ? ORDER BY s.schedule_date, s.schedule_time',
        [month, year]
    );

    // Always generate Excel
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Rekap Kegiatan');
    sheet.columns = [
        { header: 'No', key: 'no', width: 5 },
        { header: 'Judul', key: 'title', width: 30 },
        { header: 'Tanggal', key: 'date', width: 15 },
        { header: 'Jam', key: 'time', width: 15 },
        { header: 'Lokasi', key: 'location', width: 25 },
        { header: 'Target', key: 'target', width: 25 },
        { header: 'Deskripsi', key: 'desc', width: 50 },
        { header: 'Dibuat Oleh', key: 'creator', width: 20 },
    ];

    // Style header row (baris 1)
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }, // Biru
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    // Tambahkan border pada header
    headerRow.eachCell((cell) => {
        cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } },
        };
    });

    events.forEach((ev, i) => {
        // Format Target
        let targetText = ev.target_role || '-';
        try {
            if (ev.tujuan_jabatan) {
                let parsed = ev.tujuan_jabatan;
                if (typeof parsed === 'string') {
                    parsed = JSON.parse(parsed);
                }
                if (Array.isArray(parsed) && parsed.length > 0) {
                    targetText = parsed.join(', ');
                }
            }
        } catch (err) {
            // ignore parse error, fallback to target_role
        }

        // Cleanup Description (remove excessive spaces/newlines)
        let descText = ev.description || '-';
        if (descText !== '-') {
            descText = descText.replace(/\s+/g, ' ').trim();
        }

        // Format Creator
        let creatorText = '-';
        if (ev.creator_full_name) {
            creatorText = `${ev.creator_full_name} (${ev.creator_role || ''})`;
        } else if (ev.creator_username) {
            creatorText = `${ev.creator_username} (${ev.creator_role || ''})`;
        }

        const row = sheet.addRow({
            no: i + 1,
            title: ev.title || '(tanpa judul)',
            date: ev.schedule_date,
            time: ev.schedule_end_time
                ? `${ev.schedule_time} - ${ev.schedule_end_time}`
                : (ev.schedule_time || ''),
            location: ev.location || '-',
            target: targetText,
            desc: descText,
            creator: creatorText,
        });

        // Tambahkan border & alignment pada setiap cell data
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                right: { style: 'thin', color: { argb: 'FFD0D0D0' } },
            };
            // Wrap text for description and location, align others top-left
            cell.alignment = { vertical: 'top', wrapText: true };
        });
    });

    // Auto height support isn't perfect in ExcelJS, but wrapText helps.

    const buffer = await workbook.xlsx.writeBuffer();
    return new Response(buffer, {
        status: 200,
        headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': `attachment; filename=Rekap-Kegiatan-${month}-${year}.xlsx`,
        },
    });
}
