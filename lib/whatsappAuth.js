
import { initAuthCreds, BufferJSON, proto } from '@whiskeysockets/baileys';
import pool from './db';

export const useMySQLAuthState = async (sessionId = 'default') => {
    // Helper to read JSON data from DB
    const readData = async (id) => {
        try {
            const key = `${sessionId}-${id}`;
            const [rows] = await pool.query('SELECT data FROM whatsapp_sessions WHERE id = ?', [key]);
            if (rows.length > 0) {
                let data = rows[0].data;
                // mysql2 might auto-parse JSON columns
                if (typeof data === 'string') {
                    return JSON.parse(data, BufferJSON.reviver);
                }
                // If it's already an object, we need to stringify and re-parse to revive Buffers
                return JSON.parse(JSON.stringify(data), BufferJSON.reviver);
            }
        } catch (error) {
            console.error('Error reading auth state from DB:', error);
        }
        return null;
    };

    // Helper to write JSON data to DB
    const writeData = async (id, data) => {
        try {
            const key = `${sessionId}-${id}`;
            const value = JSON.stringify(data, BufferJSON.replacer);
            // UPSERT logic: Insert or Update
            await pool.query(
                `INSERT INTO whatsapp_sessions (id, data) VALUES (?, ?) 
                 ON DUPLICATE KEY UPDATE data = VALUES(data)`,
                [key, value]
            );
        } catch (error) {
            console.error('Error writing auth state to DB:', error);
        }
    };

    // Helper to remove data from DB
    const removeData = async (id) => {
        try {
            const key = `${sessionId}-${id}`;
            await pool.query('DELETE FROM whatsapp_sessions WHERE id = ?', [key]);
        } catch (error) {
            console.error('Error removing auth state from DB:', error);
        }
    };

    // Initialize creds: load from DB or create new
    const creds = (await readData('creds')) || initAuthCreds();

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    await Promise.all(
                        ids.map(async (id) => {
                            let value = await readData(`${type}-${id}`);
                            if (type === 'app-state-sync-key' && value) {
                                value = proto.Message.AppStateSyncKeyData.fromObject(value);
                            }
                            if (value) {
                                data[id] = value;
                            }
                        })
                    );
                    return data;
                },
                set: async (data) => {
                    const tasks = [];
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            const key = `${category}-${id}`;
                            if (value) {
                                tasks.push(writeData(key, value));
                            } else {
                                tasks.push(removeData(key));
                            }
                        }
                    }
                    await Promise.all(tasks);
                },
            },
        },
        saveCreds: () => {
            return writeData('creds', creds);
        },
        // Helper to clear session manually
        clearState: async () => {
            console.log('[MySQLAuth] Clearing session data...');
            try {
                // Delete all keys starting with sessionId-
                await pool.query('DELETE FROM whatsapp_sessions WHERE id LIKE ?', [`${sessionId}-%`]);
            } catch (e) {
                console.error('[MySQLAuth] Error clearing state:', e);
            }
        }
    };
};
