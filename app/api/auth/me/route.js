import { NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import * as cookie from 'cookie';
import pool from '../../../../lib/db'; // Adjust path to lib/db

export async function GET(req) {
  const cookieHeader = req.headers.get('cookie') || '';
  const cookies = cookie.parse(cookieHeader || '');
  const token = cookies.token;
  if (!token) return NextResponse.json({ user: null }, { status: 200 });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);

    // Fetch latest user data (especially full_name) from DB
    // This is better than relying on stale token data
    const [rows] = await pool.query('SELECT username, role, full_name, email FROM users WHERE id = ?', [payload.id]);

    if (rows.length > 0) {
      const user = rows[0];
      return NextResponse.json({ user: { id: payload.id, ...user } });
    }

    // Fallback if user not found in DB (unlikely)
    const user = { id: payload.id, username: payload.username, role: payload.role };
    return NextResponse.json({ user });
  } catch (err) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}