import { NextResponse } from 'next/server';
import { resetWhatsAppAuth } from '@/lib/whatsappBaileys';

export async function POST() {
    try {
        console.log('[API] Manual WhatsApp reset requested');
        await resetWhatsAppAuth();

        return NextResponse.json({
            success: true,
            message: 'WhatsApp authentication reset. New QR code will be generated.'
        });
    } catch (error) {
        console.error('[API] WhatsApp reset error:', error);
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
