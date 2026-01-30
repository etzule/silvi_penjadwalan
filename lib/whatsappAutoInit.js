// Auto-initialize WhatsApp on server startup
import { initWhatsAppClient } from './whatsappBaileys.js';

let initialized = false;

export async function autoInitWhatsApp() {
    if (initialized) {
        console.log('[WhatsApp Auto-Init] Already initialized, skipping...');
        return;
    }

    try {
        console.log('[WhatsApp Auto-Init] Starting WhatsApp client...');
        initialized = true;
        await initWhatsAppClient();
        console.log('[WhatsApp Auto-Init] WhatsApp client initialization started');
    } catch (error) {
        console.error('[WhatsApp Auto-Init] Failed to initialize:', error);
        initialized = false;
    }
}

// Auto-start when this module is imported
if (typeof window === 'undefined') {
    // Only run on server-side
    autoInitWhatsApp().catch(err => {
        console.error('[WhatsApp Auto-Init] Error during auto-initialization:', err);
    });
}
