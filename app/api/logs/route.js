import { NextResponse } from "next/server";
import db from "@/lib/db";
import * as cookie from 'cookie';
import jwt from 'jsonwebtoken';

export async function GET(req) {
    try {
        // Check authentication
        const cookieHeader = req.headers.get('cookie') || '';
        const cookies = cookie.parse(cookieHeader || '');
        const token = cookies.token;

        if (!token) {
            return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
        }

        // Verify token (all logged in users can view logs)
        try {
            jwt.verify(token, process.env.JWT_SECRET);
        } catch (e) {
            return NextResponse.json({ success: false, message: "Invalid token" }, { status: 401 });
        }

        // Fetch logs (limit 50 recent)
        // Join with schedules to get current title if needed, but we stored snapshots.
        // We want logs for: UPDATE, DELETE
        const [rows] = await db.query(
            "SELECT * FROM schedule_logs ORDER BY created_at DESC LIMIT 50"
        );

        return NextResponse.json({ success: true, data: rows });
    } catch (err) {
        console.error('Error fetching logs:', err);
        return NextResponse.json({ success: false, message: "Server error" }, { status: 500 });
    }
}
