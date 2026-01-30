import 'dotenv/config'; // Requires node -r dotenv/config or strict path setup
import db from '../lib/db.js';
import { sendWhatsAppText } from '../lib/whatsapp.js';
import dayjs from 'dayjs';

async function main() {
    console.log('--- DEBUG START ---');

    // Check Env
    console.log('WHATSAPP_API_TOKEN:', process.env.WHATSAPP_API_TOKEN ? 'Set' : 'Missing');
    console.log('WHATSAPP_PHONE_NUMBER_ID:', process.env.WHATSAPP_PHONE_NUMBER_ID ? 'Set' : 'Missing');

    if (!process.env.WHATSAPP_API_TOKEN) {
        console.error('ERROR: Token missing. Please check .env file.');
        process.exit(1);
    }

    try {
        // Check DB Connection and Users
        console.log('\n--- Checking Database ---');
        const [users] = await db.query('SELECT id, username, whatsapp, email FROM users');
        console.log(`Found ${users.length} users.`);

        const validUsers = users.filter(u => u.whatsapp);
        console.log(`Users with WhatsApp: ${validUsers.length}`);
        validUsers.forEach(u => console.log(`- ${u.username}: ${u.whatsapp}`));

        // Check Schedules
        const besok = dayjs().add(1, 'day').format('YYYY-MM-DD');
        console.log(`\n--- Checking Schedules for Tomorrow (${besok}) ---`);
        const [schedules] = await db.query('SELECT * FROM schedules WHERE schedule_date = ?', [besok]);
        console.log(`Found ${schedules.length} schedules.`);

        // Test Send
        if (validUsers.length > 0) {
            const target = validUsers[0];
            console.log(`\n--- Sending Test Message ---`);
            console.log(`Target: ${target.username} (${target.whatsapp})`);

            try {
                const res = await sendWhatsAppText({
                    to: target.whatsapp,
                    body: "Pesanan Tes: Notifikasi WhatsApp dari Debug Script. Jika ini masuk, berarti konfigurasi benar."
                });
                console.log('Success! API Response:', JSON.stringify(res, null, 2));
            } catch (error) {
                console.error('Sending Failed:', error.message);
                if (error.cause) console.error('Cause:', error.cause);
            }
        } else {
            console.log('No users with WhatsApp number found to test.');
        }

    } catch (err) {
        console.error('Runtime Error:', err);
    } finally {
        process.exit(0);
    }
}

main();
