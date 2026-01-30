import { Resend } from 'resend';

// Initialize Resend safely. If the API key is missing (e.g. during build), use a placeholder 
// or null to prevent the constructor from throwing an error.
const apiKey = process.env.RESEND_API_KEY || 're_missing_api_key';
export const resend = new Resend(apiKey);

export async function sendResendEmail({ to, subject, text, html }) {
  if (apiKey === 're_missing_api_key') {
    console.warn("⚠️ RESEND_API_KEY is missing. Email skipped.");
    return null;
  }

  return resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev',
    to,
    subject,
    text,
    html,
  });
}