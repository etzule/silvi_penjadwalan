// instrumentation.js - Auto-runs on Next.js server startup
// This file is automatically loaded by Next.js when the server starts

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Only run on Node.js runtime (server-side)
        console.log('[Instrumentation] Server starting, initializing WhatsApp...');

        try {
            // Dynamic import to avoid issues with ES modules
            const { initWhatsAppClient } = await import('./lib/whatsappBaileys.js');

            // Initialize WhatsApp client
            await initWhatsAppClient();
            console.log('[Instrumentation] WhatsApp client initialized successfully');
        } catch (error) {
            console.error('[Instrumentation] Failed to initialize WhatsApp:', error);
            // Don't throw - let the server continue even if WhatsApp fails
        }
    }
}
