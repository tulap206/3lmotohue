const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
console.log('Raw Env File Content:\n', envContent);

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

console.log('Parsed Key length:', env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length);
console.log('Parsed Key starts with:', env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(0, 10));
console.log('Parsed Key ends with:', env.NEXT_PUBLIC_SUPABASE_ANON_KEY.substring(env.NEXT_PUBLIC_SUPABASE_ANON_KEY.length - 10));
