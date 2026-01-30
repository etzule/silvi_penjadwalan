import { NextResponse } from 'next/server';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  // Clear cookie
  res.headers.set('Set-Cookie', `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict${process.env.NODE_ENV==='production'?'; Secure':''}`);
  return res;
}