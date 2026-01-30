import { NextResponse } from 'next/server';
import pool from '../../../../lib/db.js';
import { scryptSync, timingSafeEqual, randomBytes } from 'node:crypto';
import jwt from 'jsonwebtoken';

const KEY_LEN = 64;

export async function POST(req) {
  const { username, password } = await req.json();
  if (!username || !password) return NextResponse.json({ error: 'Missing' }, { status: 400 });

  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  if (!rows.length) return NextResponse.json({ error: 'Akun belum terdaftar' }, { status: 401 });

  const user = rows[0];
  const [saltHex, hashHex] = user.password_hash.split(':');
  const salt = Buffer.from(saltHex, 'hex');
  const derived = scryptSync(password, salt, KEY_LEN);
  const stored = Buffer.from(hashHex, 'hex');

  // constant time compare
  if (!timingSafeEqual(derived, stored)) {
    return NextResponse.json({ error: 'Invalid' }, { status: 401 });
  }

  // ensure we have a JWT secret; if missing in dev, generate a temporary one to avoid crashes
  let JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET) {
    // generate and set on process.env for this runtime only
    JWT_SECRET = randomBytes(64).toString('hex');
    process.env.JWT_SECRET = JWT_SECRET;
    // warn developer to set a persistent secret
    // eslint-disable-next-line no-console
    console.warn('WARNING: JWT_SECRET was not set. A temporary secret was generated for this session. Set JWT_SECRET in your .env for persistent tokens.');
  }

  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

  // return user info in response so client can set state immediately
  const res = NextResponse.json({ ok: true, user: { id: user.id, username: user.username, role: user.role } });
  // Set cookie (httpOnly)
  res.headers.set('Set-Cookie',
    `token=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 3600}; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  );

  return res;
}