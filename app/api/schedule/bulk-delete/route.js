import { NextResponse } from "next/server";
import db from "@/lib/db";
import * as cookie from 'cookie';
import jwt from 'jsonwebtoken';

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

        // Check if user is admin
        if (payload.role !== 'admin') {
            return NextResponse.json({
                success: false,
                message: "Akses ditolak. Hanya admin yang dapat menghapus kegiatan bulanan."
            }, { status: 403 });
        }

        const url = new URL(req.url);
        const month = parseInt(url.searchParams.get('month'));
        const year = parseInt(url.searchParams.get('year'));

        if (!month || !year) {
            return NextResponse.json({
                success: false,
                message: "Parameter month dan year diperlukan"
            }, { status: 400 });
        }

        // Validate month (1-12)
        if (month < 1 || month > 12) {
            return NextResponse.json({
                success: false,
                message: "Bulan tidak valid (harus 1-12)"
            }, { status: 400 });
        }

        // Delete all schedules for the given month and year
        const [result] = await db.query(
            'DELETE FROM schedules WHERE MONTH(schedule_date) = ? AND YEAR(schedule_date) = ?',
            [month, year]
        );

        return NextResponse.json({
            success: true,
            message: `Berhasil menghapus ${result.affectedRows} kegiatan pada bulan ${month}/${year}`,
            deletedCount: result.affectedRows
        });

    } catch (err) {
        console.error('Error deleting monthly schedules:', err);
        return NextResponse.json({
            success: false,
            message: "Terjadi kesalahan sistem",
            error: err.message
        }, { status: 500 });
    }
}
