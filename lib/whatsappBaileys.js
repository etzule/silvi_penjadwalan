// WhatsApp client using Baileys library
import makeWASocket, { DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import pino from 'pino';
import { useMySQLAuthState } from './whatsappAuth'; // Use MySQL Auth

// Use global state to prevent reset on Next.js dev server reloads
const globalState = globalThis;

if (!globalState.whatsapp) {
    globalState.whatsapp = {
        sock: null,
        qrCode: null,
        isConnected: false,
        isInitializing: false,
        reconnectTimeout: null,
        authFailureCount: 0,
        clearAuth: null // Add handler to clear auth
    };
}

// Helper to access state
const getState = () => globalState.whatsapp;
const MAX_AUTH_RETRIES = 3;

const logger = pino({ level: 'silent' });

export async function initWhatsAppClient() {
    const state = getState();

    // Check if already connected or socket exists
    if (state.sock && state.isConnected) {
        console.log('[WhatsApp] Already connected, reusing existing session');
        return state.sock;
    }

    // Prevent multiple simultaneous initializations
    if (state.isInitializing) {
        console.log('[WhatsApp] Already initializing, skipping...');
        return state.sock;
    }

    // Clear any pending reconnect timeout
    if (state.reconnectTimeout) {
        clearTimeout(state.reconnectTimeout);
        state.reconnectTimeout = null;
    }

    try {
        state.isInitializing = true;

        // Use MySQL Auth State
        const { state: authState, saveCreds, clearState } = await useMySQLAuthState();

        // Save clearState to global state for reset function
        state.clearAuth = clearState;

        state.sock = makeWASocket({
            auth: authState,
            printQRInTerminal: false,
            logger,
            browser: ['Ubuntu', 'Chrome', '20.0.04'], // Keep browser spoofing
            // Add connection options to make it more stable
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: undefined,
            keepAliveIntervalMs: 10000,
        });

        state.sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr) {
                state.qrCode = qr;
                console.log('[WhatsApp] QR Code generated - please scan with WhatsApp mobile');
            }

            if (connection === 'close') {
                state.isConnected = false;
                state.qrCode = null;

                // Only reconnect for specific error codes
                let shouldReconnect = false;
                let shouldShowQR = false;
                let errorCode = 'unknown';

                if (lastDisconnect?.error instanceof Boom) {
                    errorCode = lastDisconnect.error.output.statusCode;

                    // Only reconnect for these specific cases
                    shouldReconnect = errorCode === DisconnectReason.connectionClosed ||
                        errorCode === DisconnectReason.connectionLost ||
                        errorCode === DisconnectReason.restartRequired ||
                        errorCode === DisconnectReason.timedOut;
                    // Note: 440 is "connection in progress" - don't reconnect as it causes loops

                    // Show QR code for authentication failures
                    shouldShowQR = errorCode === DisconnectReason.loggedOut ||
                        errorCode === 401 || // Unauthorized
                        errorCode === 403 || // Forbidden
                        errorCode === DisconnectReason.badSession;
                }

                console.log(`[WhatsApp] Connection closed (code: ${errorCode}), will reconnect: ${shouldReconnect}, will show QR: ${shouldShowQR}`);
                state.isInitializing = false;

                if (shouldReconnect) {
                    // Reset auth failure count on normal reconnection
                    state.authFailureCount = 0;

                    // For error 440, use longer delay to prevent rapid reconnection loops
                    const delay = errorCode === 440 ? 3000 : 2000; // 3s for 440, 2s for others
                    console.log(`[WhatsApp] Reconnecting in ${delay / 1000} seconds...`);
                    state.reconnectTimeout = setTimeout(() => {
                        initWhatsAppClient();
                    }, delay);
                } else if (shouldShowQR) {
                    // Check if we've exceeded max retries
                    if (state.authFailureCount >= MAX_AUTH_RETRIES) {
                        console.log('[WhatsApp] Max authentication retries reached. Please manually restart and scan QR code.');
                        state.qrCode = null; // Prepare for manual restart
                        return;
                    }

                    console.log(`[WhatsApp] Authentication failed, retrying... (${state.authFailureCount + 1}/${MAX_AUTH_RETRIES})`);
                    state.authFailureCount++;

                    // Clear auth and retry
                    await resetWhatsAppAuth();
                } else {
                    console.log('[WhatsApp] Not reconnecting. Please scan QR code again if needed.');
                }
            } else if (connection === 'open') {
                console.log('[WhatsApp] Connected successfully!');
                state.isConnected = true;
                state.qrCode = null;
                state.isInitializing = false;
                state.authFailureCount = 0; // Reset counter on successful connection
            } else if (connection === 'connecting') {
                console.log('[WhatsApp] Connecting...');
            }
        });

        state.sock.ev.on('creds.update', saveCreds);

        return state.sock;
    } catch (error) {
        console.error('[WhatsApp] Error initializing:', error);
        state.isInitializing = false;
        throw error;
    }
}

export function getWhatsAppClient() {
    return getState().sock;
}

export function getQRCode() {
    return getState().qrCode;
}

export function isWhatsAppConnected() {
    const state = getState();
    // Check both flag and actual socket state for reliability
    // Use optional chaining for safety
    const socketConnected = state.sock && state.sock.user;
    const result = state.isConnected || !!socketConnected; // Use OR - if either is true, consider connected

    // Always log for debugging
    console.log(`[WhatsApp] Connection check: isConnected=${state.isConnected}, socketConnected=${!!socketConnected}, sock=${!!state.sock}, result=${result}`);

    return result;
}

// Function to manually reset WhatsApp authentication
export async function resetWhatsAppAuth() {
    const state = getState();
    console.log('[WhatsApp] Manually resetting authentication...');

    // Clear any pending reconnect timeout
    if (state.reconnectTimeout) {
        clearTimeout(state.reconnectTimeout);
        state.reconnectTimeout = null;
    }

    // Close existing connection
    if (state.sock) {
        try {
            await state.sock.logout();
        } catch (error) {
            console.log('[WhatsApp] Error during logout:', error.message);
        }
        state.sock = null;
    }

    // Reset state
    state.isConnected = false;
    state.isInitializing = false;
    state.qrCode = null;
    state.authFailureCount = 0;

    // Clear auth via DB
    try {
        if (state.clearAuth) {
            await state.clearAuth();
            console.log('[WhatsApp] Database auth cleared via handler');
        } else {
            // Fallback: create a temporary auth instance to clear
            const { clearState } = await useMySQLAuthState();
            await clearState();
            console.log('[WhatsApp] Database auth cleared via new instance');
        }
    } catch (error) {
        console.error('[WhatsApp] Error clearing auth:', error);
    }

    // Reinitialize
    return await initWhatsAppClient();
}

export async function sendWhatsAppMessage(phoneNumber, message) {
    const state = getState();

    if (!state.sock && !state.isConnected) {
        throw new Error('WhatsApp not connected');
    }

    // Use the available socket
    const sock = state.sock;

    try {
        let formattedNumber = phoneNumber.replace(/\D/g, '');

        if (!formattedNumber.startsWith('62')) {
            if (formattedNumber.startsWith('0')) {
                formattedNumber = '62' + formattedNumber.substring(1);
            } else {
                formattedNumber = '62' + formattedNumber;
            }
        }

        const jid = `${formattedNumber}@s.whatsapp.net`;

        await sock.sendMessage(jid, { text: message });
        console.log(`[WhatsApp] Message sent to ${phoneNumber}`);
        return { success: true, message: 'Message sent' };
    } catch (error) {
        console.error('[WhatsApp] Error sending message:', error);
        throw error;
    }
}
