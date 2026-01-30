import { NextResponse } from "next/server";
import db from "@/lib/db";
import * as cookie from 'cookie';
import jwt from 'jsonwebtoken';

// GET all users (lightweight, for selection dropdowns)
export async function GET(req) {
    const cookieHeader = req.headers.get('cookie') || '';
    const cookies = cookie.parse(cookieHeader || '');
    const token = cookies.token;

    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    let payload;
    try {
        payload = jwt.verify(token, process.env.JWT_SECRET);
    } catch (e) {
        return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Optional: Restrict to Admin only if desired, but general users might need this for other features later.
    // The user specifically asked for "Admin Eksklusif", so let's check role if strictness is needed.
    // For now, allowing authenticated users is safe as we only return public info (name, role).

    if (payload.role !== 'admin') {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    try {
        // Select only necessary fields
        const [rows] = await db.query(
            "SELECT id, username, full_name, role FROM users ORDER BY full_name ASC, username ASC"
        );
        return NextResponse.json(rows);
    } catch (err) {
        console.error('Failed to fetch users:', err);
        return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }
}
