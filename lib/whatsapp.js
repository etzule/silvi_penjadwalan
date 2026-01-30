// Helper untuk mengirim pesan WhatsApp via WhatsApp Business Cloud API
// Pastikan environment variable berikut sudah di-set:
// - WHATSAPP_TOKEN
// - WHATSAPP_PHONE_NUMBER_ID
//
// Catatan:
// - Untuk notifikasi di luar 24 jam terakhir chat, sebaiknya gunakan template yang sudah di-approve.

async function callWhatsAppAPI(payload) {
  const token = process.env.WHATSAPP_API_TOKEN || process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;

  if (!token || !phoneNumberId) {
    throw new Error("WHATSAPP_API_TOKEN / WHATSAPP_PHONE_NUMBER_ID belum dikonfigurasi");
  }

  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    throw new Error(`WhatsApp API error ${res.status}: ${JSON.stringify(data)}`);
  }

  return data;
}

// Kirim pesan teks sederhana (hanya bisa dipakai dalam window 24 jam session atau use case yang diizinkan)
export async function sendWhatsAppText({ to, body }) {
  if (!to) throw new Error("Missing WhatsApp number (to)");

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      body,
    },
  };

  return callWhatsAppAPI(payload);
}

// Kirim pesan template (disarankan untuk notifikasi terjadwal)
export async function sendWhatsAppTemplate({ to, templateName, languageCode = "id", components = [] }) {
  if (!to) throw new Error("Missing WhatsApp number (to)");
  if (!templateName) throw new Error("Missing templateName");

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "template",
    template: {
      name: templateName,
      language: {
        code: languageCode,
      },
      ...(components && components.length ? { components } : {}),
    },
  };

  return callWhatsAppAPI(payload);
}

