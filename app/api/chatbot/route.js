import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import dayjs from 'dayjs';
import * as cookie from 'cookie';
import jwt from 'jsonwebtoken';

// Initialize Gemini AI with API key from environment
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_MODELS = [
  'gemini-flash-latest',
  'gemini-3-flash-preview',
  'gemini-2.5-flash-lite'
];

async function generateContentWithFallback(contents, config) {
  let lastError = null;
  for (const model of GEMINI_MODELS) {
    try {
      const result = await ai.models.generateContent({
        model: model,
        contents: contents,
        config: config
      });
      return result;
    } catch (error) {
      console.warn(`Model ${model} failed:`, error.message);
      lastError = error;

      const isQuotaError = error.status === 429 ||
        (error.message && (
          error.message.toLowerCase().includes('quota') ||
          error.message.includes('429') ||
          error.message.toLowerCase().includes('resource exhausted')
        ));

      if (isQuotaError) {
        continue;
      }
      throw error;
    }
  }
  throw lastError || new Error('All models failed to generate content');
}

export async function POST(request) {
  try {
    const { message, history = [], userId } = await request.json();

    if (!message || message.trim() === '') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Get user info for authorization
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = cookie.parse(cookieHeader);
    const token = cookies.token;

    let currentUser = null;
    if (token) {
      try {
        currentUser = jwt.verify(token, process.env.JWT_SECRET);
      } catch (e) {
        // Invalid token, continue without user
      }
    }

    // Get user's schedules for context
    let scheduleContext = '';
    // Get user's schedules for context - NOW FOR ALL USERS (GUESTS INCLUDED)


    try {
      const [schedules] = await pool.query(
        `SELECT s.id, s.title, s.description, s.location, s.schedule_date, s.schedule_time, s.schedule_end_time, 
                s.tujuan_jabatan, s.target_role, s.creator_id, u.full_name as creator_name, u.username as creator_username
          FROM schedules s
          LEFT JOIN users u ON s.creator_id = u.id
          WHERE s.schedule_date >= CURDATE() - INTERVAL 7 DAY
          ORDER BY s.schedule_date ASC, s.schedule_time ASC
          LIMIT 50`
      );

      if (schedules && schedules.length > 0) {
        scheduleContext = '\n\n=== DATA JADWAL KEGIATAN ===\n';
        schedules.forEach((s, idx) => {
          const date = dayjs(s.schedule_date).format('DD MMMM YYYY');
          const time = s.schedule_time || '-';
          const endTime = s.schedule_end_time || '-';
          scheduleContext += `\n${idx + 1}. ID: ${s.id} | ${s.title}`;
          scheduleContext += `\n   Tanggal: ${date}`;
          scheduleContext += `\n   Waktu: ${time}${endTime !== '-' ? ' - ' + endTime : ''}`;
          if (s.description) scheduleContext += `\n   Deskripsi: ${s.description}`;
          if (s.location) scheduleContext += `\n   Lokasi: ${s.location}`;
          const creator = s.creator_name || s.creator_username || 'Admin';
          scheduleContext += `\n   Dibuat oleh: ${creator}`;
          if (s.tujuan_jabatan) {
            try {
              const roles = JSON.parse(s.tujuan_jabatan);
              scheduleContext += `\n   Untuk: ${roles.join(', ')}`;
            } catch (e) {
              if (s.target_role) scheduleContext += `\n   Untuk: ${s.target_role}`;
            }
          } else if (s.target_role) {
            scheduleContext += `\n   Untuk: ${s.target_role}`;
          }
        });
        scheduleContext += '\n\n=== AKHIR DATA JADWAL ===\n';
      }
    } catch (dbError) {
      console.error('Error fetching schedules:', dbError);
    }

    // Get schedule logs for context (history of changes)
    let logContext = '';
    try {
      const [logs] = await pool.query(
        `SELECT l.id, l.action_type, l.schedule_id, l.old_data, l.new_data, l.created_at, l.editor_name, s.title as current_title
         FROM schedule_logs l
         LEFT JOIN schedules s ON l.schedule_id = s.id
         ORDER BY l.created_at DESC
         LIMIT 20`
      );

      if (logs && logs.length > 0) {
        logContext = '\n\n=== RIWAYAT PERUBAHAN JADWAL (AUDIT LOGS) ===\n';
        logs.forEach((l, idx) => {
          const date = dayjs(l.created_at).format('DD MMM YYYY HH:mm');
          const type = l.action_type === 'DELETE' ? 'PENGHAPUSAN' : 'PERUBAHAN';

          let details = '';
          try {
            const old = typeof l.old_data === 'string' ? JSON.parse(l.old_data) : l.old_data;
            const neu = typeof l.new_data === 'string' ? JSON.parse(l.new_data) : l.new_data;
            const title = l.current_title || old?.title || 'Jadwal';

            logContext += `\n${idx + 1}. [${date}] ${type} pada "${title}" oleh ${l.editor_name || 'Admin'}`;

            if (l.action_type === 'UPDATE' && old && neu) {
              if (old.schedule_date !== neu.schedule_date) details += `   - Tanggal: ${old.schedule_date} -> ${neu.schedule_date}\n`;
              if (old.schedule_time !== neu.schedule_time) details += `   - Waktu: ${old.schedule_time} -> ${neu.schedule_time}\n`;
              if (old.location !== neu.location) details += `   - Lokasi: ${old.location || '-'} -> ${neu.location || '-'}\n`;
              if (old.title !== neu.title) details += `   - Judul: ${old.title} -> ${neu.title}\n`;
            } else if (l.action_type === 'DELETE') {
              details += `   - Jadwal dihapus dari sistem.\n`;
            }
            if (details) logContext += `\n${details}`;
          } catch (e) {
            // ignore parse error
          }
        });
        logContext += '\n=== AKHIR RIWAYAT PERUBAHAN ===\n';
      }
    } catch (logError) {
      console.error('Error fetching logs:', logError);
    }

    // Build system prompt with function calling instructions
    const systemPrompt = `Kamu adalah asisten virtual SILVI (Sistem Informasi Jadwal & Kegiatan Secara Virtual) untuk aplikasi penjadwalan kelurahan.

PERAN DAN KEPRIBADIAN:
- Kamu membantu pengguna mengelola dan mencari informasi tentang jadwal kegiatan
- Berbicara dalam Bahasa Indonesia yang sopan dan profesional
- Ramah, helpful, dan responsif
- Gunakan emoji sesekali untuk membuat percakapan lebih menarik 😊

KEMAMPUAN KAMU:
1. Menjawab pertanyaan tentang jadwal kegiatan
2. **Menjawab pertanyaan tentang PERUBAHAN/EDIT jadwal** (gunakan RIWAYAT PERUBAHAN JADWAL)
3. Mencari kegiatan berdasarkan tanggal, waktu, atau kata kunci
4. Memberikan ringkasan jadwal (hari ini, besok, minggu ini)
5. **MEMBUAT jadwal baru** (gunakan function create_schedule)
6. **TIDAK BISA mengedit atau menghapus jadwal** (jelaskan bahwa kamu hanya bisa membantu menambah jadwal)
7. Memberikan saran dan reminder

CARA MENGGUNAKAN FUNCTIONS:
- Jika user meminta "buat jadwal", "tambah jadwal", "buatkan acara", dll → gunakan create_schedule
- Pastikan data lengkap sebelum membuat jadwal (Judul, Tanggal, Waktu, Lokasi).
- Jika user meminta "ubah jadwal", "edit jadwal", "hapus jadwal" → TOLAK dengan sopan dan katakan bahwa kamu tidak memiliki akses untuk mengubah data yang sudah ada demi keamanan data.
- Jika user menyebut lokasi ("di Kantor Kelurahan", "di Balai RW"), extract sebagai location
- Tanyakan detail yang kurang jika user ingin membuat jadwal.

FORMAT TANGGAL & WAKTU:
- Tanggal: YYYY-MM-DD (contoh: 2026-01-23)
- Waktu: HH:MM (contoh: 10:00, 14:30)
- Jika user bilang "besok", hitung dari tanggal hari ini (${dayjs().add(1, 'day').format('YYYY-MM-DD')})
- Jika user bilang "hari ini", gunakan tanggal hari ini (${dayjs().format('YYYY-MM-DD')})
- Jika user bilang "jam 10", anggap 10:00

FORMAT LOKASI:
- Jika user menyebut "di [tempat]", extract sebagai location
- Contoh: "di Kantor Kelurahan" → location: "Kantor Kelurahan"
- Contoh: "di Balai RW 05" → location: "Balai RW 05"
- Jika tidak disebutkan, location boleh kosong

CARA MENJAWAB:
- Jika ditanya tentang jadwal, gunakan data dari "DATA JADWAL KEGIATAN"
- Berikan informasi yang akurat dan lengkap
- Jika tidak ada jadwal yang relevan, katakan dengan jelas
- Jika pertanyaan di luar konteks jadwal, tetap jawab dengan ramah tapi arahkan ke fungsi utama
- Setelah berhasil create/update jadwal, konfirmasi dengan detail yang jelas

PENTING:
- Selalu gunakan data dari "DATA JADWAL KEGIATAN" untuk menjawab pertanyaan tentang jadwal
- Jangan membuat-buat jadwal yang tidak ada dalam data
- Jika data kosong, katakan "Saat ini belum ada jadwal yang terdaftar"
- Untuk edit jadwal, WAJIB gunakan ID yang benar dari data
${scheduleContext}
${logContext}`;

    // Define function declarations for Gemini
    const tools = [
      {
        functionDeclarations: [
          {
            name: 'create_schedule',
            description: 'Membuat jadwal kegiatan baru di sistem',
            parameters: {
              type: 'object',
              properties: {
                title: {
                  type: 'string',
                  description: 'Judul/nama kegiatan'
                },
                description: {
                  type: 'string',
                  description: 'Deskripsi detail kegiatan (optional)'
                },
                location: {
                  type: 'string',
                  description: 'Lokasi/tempat kegiatan (optional, contoh: Kantor Kelurahan, Balai RW 05)'
                },
                schedule_date: {
                  type: 'string',
                  description: 'Tanggal kegiatan dalam format YYYY-MM-DD'
                },
                schedule_time: {
                  type: 'string',
                  description: 'Waktu mulai dalam format HH:MM (24 jam)'
                },
                schedule_end_time: {
                  type: 'string',
                  description: 'Waktu selesai dalam format HH:MM (optional)'
                },
                target_role: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Target jabatan: ["lurah"], ["sekretaris kelurahan"], atau jabatan kustom lainnya (contoh: ["Ketua RW 01"])'
                }
              },
              required: ['title', 'schedule_date', 'schedule_time']
            }
          }
        ]
      }
    ];

    // Build conversation context
    let conversationContext = systemPrompt + '\n\n';

    if (history.length > 0) {
      conversationContext += '=== RIWAYAT PERCAKAPAN ===\n';
      history.forEach(msg => {
        const role = msg.role === 'user' ? 'Pengguna' : 'SILVI';
        conversationContext += `${role}: ${msg.content}\n`;
      });
      conversationContext += '\n';
    }

    conversationContext += `Pengguna: ${message}\n\nSILVI:`;

    // Generate response with function calling using fallback
    const response = await generateContentWithFallback(conversationContext, {
      tools: tools,  // Tools must be inside config!
      maxOutputTokens: 1000,
      temperature: 0.7,
    });

    // Check if there's a function call
    const functionCall = response.functionCalls?.[0];

    if (functionCall) {
      // Handle function call
      const functionName = functionCall.name;
      const functionArgs = functionCall.args;

      console.log('Function called:', functionName, functionArgs);

      let functionResult = null;

      // Execute the appropriate function
      if (functionName === 'create_schedule') {
        // Call schedule API to create
        try {
          const baseUrl = request.url.split('/api/chatbot')[0];
          const scheduleResponse = await fetch(`${baseUrl}/api/schedule`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Cookie': cookieHeader
            },
            body: JSON.stringify(functionArgs)
          });

          const scheduleData = await scheduleResponse.json();

          if (scheduleResponse.ok) {
            functionResult = {
              success: true,
              message: 'Jadwal berhasil dibuat',
              data: functionArgs
            };
          } else {
            functionResult = {
              success: false,
              error: scheduleData.message || scheduleData.error || 'Gagal membuat jadwal'
            };
          }
        } catch (error) {
          functionResult = {
            success: false,
            error: 'Terjadi kesalahan saat membuat jadwal: ' + error.message
          };
        }


        // Send function result back to Gemini to generate natural language response
        const followUpContext = conversationContext + `\n\n[Function ${functionName} executed with result: ${JSON.stringify(functionResult)}]\n\nBerikan response yang natural dan user-friendly dalam Bahasa Indonesia tentang hasil function call ini. Jika sukses, konfirmasi detail jadwal. Jika gagal, jelaskan errornya dengan ramah.\n\nSILVI:`;

        const followUpResponse = await generateContentWithFallback(followUpContext, {
          maxOutputTokens: 500,
          temperature: 0.7,
        });

        const responseText = followUpResponse.text;

        return NextResponse.json({
          success: true,
          response: responseText,
          functionCalled: functionName,
          functionResult: functionResult,
          timestamp: new Date().toISOString()
        });
      }

      // No function call, just return the text response
      const responseText = response.text;

      if (!responseText) {
        throw new Error('Empty response from AI');
      }

      return NextResponse.json({
        success: true,
        response: responseText,
        timestamp: new Date().toISOString()
      });

    }

    // No function call, just return the text response
    const normalResponseText = response.text;

    if (!normalResponseText) {
      throw new Error('Empty response from AI');
    }

    return NextResponse.json({
      success: true,
      response: normalResponseText,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Chatbot API Error Details:', error);

    // Handle specific Gemini API errors
    if (error.message?.includes('API_KEY') || error.message?.includes('apiKey')) {
      return NextResponse.json(
        { error: 'API key tidak valid. Silakan periksa konfigurasi.' },
        { status: 500 }
      );
    }
    if (error.status === 429 || error.message?.includes('quota')) {
      return NextResponse.json(
        { error: 'Quota API habis. Silakan coba lagi nanti.' },
        { status: 429 }
      );
    }

    // Generic error response
    return NextResponse.json(
      {
        error: 'Maaf, terjadi kesalahan. Silakan coba lagi.',
        response: 'Maaf, saya sedang mengalami gangguan. Silakan coba lagi dalam beberapa saat. 🙏',
        details: error.message
      },
      { status: 500 }
    );
  }
}
