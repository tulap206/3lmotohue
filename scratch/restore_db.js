const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// 1. Read env variables from .env.local
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

console.log('Restoring to Supabase URL:', url);
const supabase = createClient(url, key);

// Find the latest backup file in the backups folder
const backupsDir = path.join(__dirname, '../backups');
if (!fs.existsSync(backupsDir)) {
  console.error('Backups directory not found!');
  process.exit(1);
}

const backupFiles = fs.readdirSync(backupsDir)
  .filter(f => f.startsWith('database_backup_') && f.endsWith('.json'))
  .sort((a, b) => b.localeCompare(a)); // Newest first

if (backupFiles.length === 0) {
  console.error('No backup files found in backups/ folder.');
  process.exit(1);
}

const latestBackup = path.join(backupsDir, backupFiles[0]);
console.log(`Loading backup data from: ${latestBackup}`);
const backupData = JSON.parse(fs.readFileSync(latestBackup, 'utf8'));

const tables = ['vehicles', 'customers', 'rentals', 'transactions', 'access_logs'];

async function restore() {
  for (const table of tables) {
    const rows = backupData[table];
    if (!rows || rows.length === 0) {
      console.log(`No data to restore for table "${table}"`);
      continue;
    }

    console.log(`\nRestoring ${rows.length} rows to table "${table}"...`);

    // Clean rows to avoid schema mismatch if there are undefined/null primary keys
    const cleanRows = rows.map(r => {
      // Remove temporary fields or properties that don't match supabase columns
      return r;
    });

    // Upsert rows in batches to avoid API size limits
    const batchSize = 100;
    for (let i = 0; i < cleanRows.length; i += batchSize) {
      const batch = cleanRows.slice(i, i + batchSize);
      const { error } = await supabase.from(table).upsert(batch, { onConflict: 'id' });
      
      if (error) {
        console.error(`❌ Error restoring batch to "${table}":`, error);
      } else {
        console.log(`✔ Restored rows ${i + 1} to ${Math.min(i + batchSize, cleanRows.length)}`);
      }
    }
  }
  console.log('\n🎉 Database restore operation completed!');
}

restore().catch(err => {
  console.error('Restore failed:', err);
  process.exit(1);
});
