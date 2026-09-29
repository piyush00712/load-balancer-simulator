/**
 * Starts all 3 backend nodes + the load balancer together, in one
 * process, and keeps them running until you stop it (Ctrl+C) —
 * unlike run-demo.js, this does NOT fire a burst or shut itself down.
 * Use this when you want to sit on the dashboard and click "Fire burst"
 * yourself, as many times as you like.
 *
 * Run with: npm run dashboard
 */
const { spawn } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const children = [];

function startProcess(label, scriptArgs, env = {}) {
  const child = spawn('node', scriptArgs, {
    cwd: ROOT,
    env: { ...process.env, ...env },
    stdio: 'inherit',
  });
  children.push(child);
  return child;
}

function shutdown() {
  console.log('\nShutting down...');
  children.forEach((c) => c.kill());
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

console.log('--- Starting 3 backend nodes ---');
startProcess('backend-4001', ['backend/server.js', '4001', '50', '150']);
startProcess('backend-4002', ['backend/server.js', '4002', '50', '150']);
startProcess('backend-4003', ['backend/server.js', '4003', '50', '150']);

setTimeout(() => {
  console.log('\n--- Starting load balancer (least-connections, max 3 concurrent/server) ---');
  startProcess('loadbalancer', ['loadbalancer/server.js'], {
    STRATEGY: 'least-connections',
    MAX_CONCURRENT: '3',
  });

  setTimeout(() => {
    console.log('\nDashboard: http://localhost:4000/');
    console.log('Everything is running. Press Ctrl+C to stop.');
  }, 500);
}, 500);
