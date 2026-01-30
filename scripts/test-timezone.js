const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');

dayjs.extend(utc);
dayjs.extend(timezone);

dayjs.tz.setDefault("Asia/Jakarta");

console.log("=== Timezone Verification ===");
const now = dayjs();
const nowTz = dayjs().tz();

console.log('System Time (Local/V8):', new Date().toString());
console.log('Dayjs UTC:', dayjs.utc().format());
console.log('Dayjs Jakarta (tz):', nowTz.format());

// Logic verification
const todayStr = nowTz.format('YYYY-MM-DD');
const tomStr = nowTz.add(1, 'day').format('YYYY-MM-DD');

console.log('\nLogic Check:');
console.log('Today (Jakarta):', todayStr);
console.log('Tomorrow (Jakarta):', tomStr);

const testDate = '2023-10-27';
const diff = dayjs(testDate).startOf('day').diff(nowTz.startOf('day'), 'day');
console.log(`Diff check for ${testDate} vs Today:`, diff);

console.log("\nIf 'Dayjs Jakarta' matches your current wall clock time in Indonesia, the fix is working.");
