import { NextResponse } from 'next/server';
import { sendWhatsAppMessage, isWhatsAppConnected } from '@/lib/whatsappBaileys';

export async function POST(request) {
    try {
        const { phoneNumber, message } = await request.json();

        if (!phoneNumber || !message) {
            return NextResponse.json(
                { success: false, error: 'Phone number and message are required' },
                { status: 400 }
            );
        }

        if (!isWhatsAppConnected()) {
            return NextResponse.json(
                { success: false, error: 'WhatsApp not connected. Please scan QR code first.' },
                { status: 503 }
            );
        }

        const result = await sendWhatsAppMessage(phoneNumber, message);

        return NextResponse.json({
            success: true,
            message: 'Message sent successfully',
            data: result
        });
    } catch (error) {
        console.error('Send message error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
