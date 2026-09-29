/**
 * Backend server node.
 * Simulates a real application server: accepts work, takes a variable
 * amount of time to process it (to make routing decisions meaningful),
 * and reports its own load so the load balancer can make informed choices.
 *
 * Usage: node backend/server.js <port> [minDelayMs] [maxDelayMs]
 */
const express = require('express');

const port = process.argv[2] || 4001;
const minDelay = Number(process.argv[3] || 50);
const maxDelay = Number(process.argv[4] || 250);

const app = express();
let activeRequests = 0;
let totalHandled = 0;

app.get('/health', (req, res) => {
  res.json({ status: 'ok', port, activeRequests, totalHandled });
});

app.get('/work', (req, res) => {
  activeRequests += 1;
  const delay = Math.floor(Math.random() * (maxDelay - minDelay + 1)) + minDelay;

  setTimeout(() => {
    activeRequests -= 1;
    totalHandled += 1;
    res.json({ servedBy: `node-${port}`, delayMs: delay, totalHandled });
  }, delay);
});

app.listen(port, () => {
  console.log(`Backend node listening on port ${port} (delay ${minDelay}-${maxDelay}ms)`);
});
