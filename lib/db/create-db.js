import fs from 'fs';
import path from 'path';
import pg from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read and parse .env file
const envPath = path.join(__dirname, '../../.env');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const firstEqual = trimmed.indexOf('=');
    if (firstEqual === -1) return;
    const key = trimmed.substring(0, firstEqual).trim();
    const val = trimmed.substring(firstEqual + 1).trim();
    env[key] = val;
  });
}

const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL not found in .env or environment.");
  process.exit(1);
}

// Replace database name in connection string with 'postgres' to connect and create the target DB
const urlObj = new URL(dbUrl);
const targetDb = urlObj.pathname.substring(1); // 'clinicflow'
urlObj.pathname = '/postgres';
const baseDbUrl = urlObj.toString();

console.log(`Connecting to temporary DB ${baseDbUrl} to check/create database "${targetDb}"...`);

const { Client } = pg;
const client = new Client({
  connectionString: baseDbUrl
});

async function main() {
  await client.connect();
  const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [targetDb]);
  if (res.rowCount === 0) {
    console.log(`Database "${targetDb}" does not exist. Creating...`);
    // Cannot run CREATE DATABASE inside a transaction or with parameterized query, so we run a raw query
    await client.query(`CREATE DATABASE "${targetDb.replace(/"/g, '""')}"`);
    console.log(`Database "${targetDb}" created successfully.`);
  } else {
    console.log(`Database "${targetDb}" already exists.`);
  }
}

main()
  .then(() => {
    client.end();
    process.exit(0);
  })
  .catch(err => {
    console.error("Error checking/creating database:", err.message);
    client.end();
    process.exit(1);
  });
