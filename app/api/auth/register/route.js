import { NextResponse } from 'next/server';
import pool from '../../../../lib/db.js'; // adjust path if needed
import { randomBytes, scryptSync } from 'node:crypto';
import { jwtVerify } from 'jose';
import * as cookie from 'cookie';

const SALT_BYTES = 16;
const KEY_LEN = 64; // bytes

export async function POST(req) {
  // Admin-only authentication check
  const authHeader = req.headers.get('authorization');
  let token;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  } else {
    // Try getting token from cookies
    const cookieHeader = req.headers.get('cookie') || '';
    const cookies = cookie.parse(cookieHeader);
    token = cookies.token;
  }

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized: Admin access required' }, { status: 401 });
  }

  const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'your-secret-key');

  try {
    const { payload } = await jwtVerify(token, secret);

    // Only admin can register new users
    if (payload.role !== 'admin') {
      return NextResponse.json({
        error: 'Forbidden: Only administrators can register new users'
      }, { status: 403 });
    }
  } catch (err) {
    console.error('JWT verification failed:', err);
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }

  const body = await req.json();
  console.log('REGISTER BODY:', body);
  const { username, password, role, email, whatsapp, full_name } = body;

  if (!username || !password || !role || !email) {
    return NextResponse.json({ error: 'Missing required fields (username, password, role, email)' }, { status: 400 });
  }

  // Use username as full_name if not provided
  const finalFullName = full_name || username;

  // Allow registration for all roles (admin can create any role)
  if (!['lurah', 'sekretaris kelurahan', 'admin'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  // Basic email format validation
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  // WhatsApp validation (optional, but recommended)
  if (whatsapp && !/^62\d{8,15}$/.test(whatsapp)) {
    return NextResponse.json({ error: 'Invalid WhatsApp number' }, { status: 400 });
  }

  // basic username/email uniqueness check
  const [existingUser] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
  if (existingUser.length) {
    return NextResponse.json({ error: 'Username already exists' }, { status: 400 });
  }
  const [existingEmail] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existingEmail.length) {
    return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
  }
  if (whatsapp) {
    const [existingWa] = await pool.query('SELECT id FROM users WHERE whatsapp = ?', [whatsapp]);
    if (existingWa.length) {
      return NextResponse.json({ error: 'WhatsApp number already exists' }, { status: 400 });
    }
  }

  // hash: store salt:hash (hex)
  const salt = randomBytes(SALT_BYTES);
  const derived = scryptSync(password, salt, KEY_LEN);
  const password_hash = `${salt.toString('hex')}:${derived.toString('hex')}`;

  await pool.query(
    'INSERT INTO users (username, email, whatsapp, password_hash, role, full_name) VALUES (?, ?, ?, ?, ?, ?)',
    [username, email, whatsapp || null, password_hash, role, finalFullName]
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}