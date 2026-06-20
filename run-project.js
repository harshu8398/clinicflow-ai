import fs from 'fs';
import path from 'path';
import { spawn, execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. Read and parse .env file
const envPath = path.join(__dirname, '.env');
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

// Ensure critical variables are set
const dbUrl = env.DATABASE_URL || process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("Error: DATABASE_URL not found in .env or environment.");
  process.exit(1);
}

// Add system env variables to our map
const apiEnv = { ...process.env, ...env, NODE_ENV: 'development', PORT: '5000' };
const clientEnv = { ...process.env, ...env, NODE_ENV: 'development', PORT: '3000' };

const isWindows = process.platform === 'win32';
const pnpmCmd = isWindows ? 'pnpm.cmd' : 'pnpm';

console.log("Pushing database schema using drizzle-kit...");
try {
  execSync(`${pnpmCmd} --filter @workspace/db run push`, {
    stdio: 'inherit',
    env: apiEnv
  });
  console.log("Database schema synchronized successfully.\n");
} catch (err) {
  console.error("Warning/Error: DB schema push failed. Proceeding anyway...", err.message);
}

// Function to prefix logs from child processes
function logStream(stream, prefix) {
  stream.on('data', (data) => {
    const lines = data.toString().split('\n');
    lines.forEach(line => {
      if (line.trim()) {
        console.log(`[${prefix}] ${line}`);
      }
    });
  });
}

console.log("Starting API Server on port 5000...");
const apiProcess = spawn('node', ['--enable-source-maps', './artifacts/api-server/dist/index.mjs'], {
  env: apiEnv,
  shell: true
});

logStream(apiProcess.stdout, 'API');
logStream(apiProcess.stderr, 'API_ERR');

apiProcess.on('close', (code) => {
  console.log(`[API] Process exited with code ${code}`);
  process.exit(code);
});

console.log("Starting Frontend Server on port 3000...");
const clientProcess = spawn(pnpmCmd, ['--filter', '@workspace/clinicflow', 'run', 'dev'], {
  env: clientEnv,
  shell: true
});

logStream(clientProcess.stdout, 'Frontend');
logStream(clientProcess.stderr, 'Frontend_ERR');

clientProcess.on('close', (code) => {
  console.log(`[Frontend] Process exited with code ${code}`);
  process.exit(code);
});

// Handle termination gracefully
process.on('SIGINT', () => {
  console.log("\nStopping services...");
  apiProcess.kill();
  clientProcess.kill();
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log("\nStopping services...");
  apiProcess.kill();
  clientProcess.kill();
  process.exit(0);
});
