/**
 * Demo: boots 3 backend nodes + the load balancer, then fires a burst of
 * concurrent requests to prove routing and queueing behave as expected.
 * Run with: npm run demo
 */
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const children = [];

function startProcess(scriptArgs, env = {}) {
  const child = spawn('node', scriptArgs, { cwd: ROOT, env: { ...process.env, ...env }, stdio: 'inherit' });
  children.push(child);
  return child;
}

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log('--- Starting 3 backend nodes ---');
  startProcess(['backend/server.js', '4001', '50', '150']);
  startProcess(['backend/server.js', '4002', '50', '150']);
  startProcess(['backend/server.js', '4003', '50', '150']);

  await sleep(500);

  console.log('\n--- Starting load balancer (least-connections, max 3 concurrent/server) ---');
  startProcess(['loadbalancer/server.js'], { STRATEGY: 'least-connections', MAX_CONCURRENT: '3' });

  await sleep(500);

  console.log('\n--- Firing a burst of 30 concurrent requests (pool capacity is 9 at once) ---');
  const requests = Array.from({ length: 30 }, (_, i) => get('http://localhost:4000/work').then((r) => {
    console.log(`Request ${i + 1}: HTTP ${r.status} -> ${r.body}`);
  }));
  await Promise.all(requests);

  await sleep(300);
  const stats = await get('http://localhost:4000/stats');
  console.log('\n--- Final load balancer stats ---');
  console.log(stats.body);

  console.log('\nDashboard was available at http://localhost:4000/ while this ran.');
  console.log('Demo complete. Shutting down.');
  children.forEach((c) => c.kill());
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  children.forEach((c) => c.kill());
  process.exit(1);
});
