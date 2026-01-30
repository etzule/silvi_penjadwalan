import { NextResponse } from 'next/server';
import { getQRCode, isWhatsAppConnected } from '@/lib/whatsappBaileys';

// Note: WhatsApp is initialized by instrumentation.js on server start
// This API only checks status, does NOT initialize

export async function GET() {
    try {
        const qr = getQRCode();
        const connected = isWhatsAppConnected();

        return NextResponse.json({
            success: true,
            connected,
            qrCode: qr,
            message: connected ? 'WhatsApp connected' : (qr ? 'Scan QR code to connect' : 'Connecting...')
        });
    } catch (error) {
        console.error('WhatsApp status error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
