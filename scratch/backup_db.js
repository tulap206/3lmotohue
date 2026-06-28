const fs = require('fs');
const path = require('path');
const https = require('https');

// Load env variables from .env.local
const envPath = path.join(__dirname, '../.env.local');
if (!fs.existsSync(envPath)) {
  console.error('.env.local not found!');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const cleanLine = line.replace('\r', '').trim();
  const match = cleanLine.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] ? match[2].trim() : '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value;
  }
});

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Supabase URL or Key missing in .env.local');
  process.exit(1);
}

console.log('Supabase URL:', url);
console.log('Backing up tables from Supabase...');

const tables = ['vehicles', 'customers', 'rentals', 'transactions', 'access_logs'];
const backupData = {};

function fetchTable(table) {
  return new Promise((resolve, reject) => {
    const endpoint = `${url}/rest/v1/${table}?select=*`;
    const options = {
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    };

    https.get(endpoint, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`Failed to fetch ${table}: ${res.statusCode} - ${data}`));
          } else {
            const json = JSON.parse(data);
            console.log(`Fetched ${json.length} rows from table "${table}"`);
            resolve(json);
          }
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  try {
    for (const table of tables) {
      backupData[table] = await fetchTable(table);
    }
    const backupDir = path.join(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `database_backup_${timestamp}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
    console.log(`\n🎉 Backup complete! Saved to ${backupFile}`);
  } catch (err) {
    console.error('Backup failed:', err);
    process.exit(1);
  }
}

run();
