/**
 * Load Balancer
 * Distributes incoming traffic across multiple backend server nodes.
 *
 * Supports two routing strategies:
 *   - round-robin: cycles through servers in order
 *   - least-connections: sends each request to whichever server currently
 *     has the fewest requests in flight
 *
 * Also implements a request queue: if every backend is already at its
 * concurrency limit, incoming requests are buffered in a FIFO queue
 * instead of being dropped, and drained as capacity frees up. This
 * absorbs traffic bursts without overloading any single server.
 *
 * GET /            -> live dashboard (static HTML, see public/dashboard.html)
 * GET /stats       -> JSON stats (used by the dashboard's polling and available directly)
 * anything else    -> proxied to a backend node per the routing strategy
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const httpProxy = require('http-proxy');

const STRATEGY = process.env.STRATEGY || 'round-robin'; // 'round-robin' | 'least-connections'
const PORT = process.env.PORT || 4000;
const MAX_CONCURRENT_PER_SERVER = Number(process.env.MAX_CONCURRENT || 3);

const servers = (process.env.SERVERS || 'localhost:4001,localhost:4002,localhost:4003')
  .split(',')
  .map((hostPort) => {
    const [host, port] = hostPort.split(':');
    return { host, port, activeConnections: 0, totalRouted: 0 };
  });

const proxy = httpProxy.createProxyServer({});
let rrIndex = 0;
const queue = [];
let queuedCount = 0;
let maxQueueDepthSeen = 0;

const dashboardHtml = fs.readFileSync(path.join(__dirname, 'public', 'dashboard.html'));
const dashboardCss = fs.readFileSync(path.join(__dirname, 'public', 'style.css'));

function pickServer_roundRobin() {
  const server = servers[rrIndex % servers.length];
  rrIndex += 1;
  return server;
}

function pickServer_leastConnections() {
  return servers.reduce((best, s) => (s.activeConnections < best.activeConnections ? s : best), servers[0]);
}

function pickServer() {
  return STRATEGY === 'least-connections' ? pickServer_leastConnections() : pickServer_roundRobin();
}

function serverHasCapacity(server) {
  return server.activeConnections < MAX_CONCURRENT_PER_SERVER;
}

function anyServerHasCapacity() {
  return servers.some(serverHasCapacity);
}

function routeRequest(req, res) {
  let server = pickServer();

  // If the chosen server (by strategy) is full, look for any server with room.
  if (!serverHasCapacity(server)) {
    const fallback = servers.find(serverHasCapacity);
    if (!fallback) {
      // Every server is fully loaded -> queue this request instead of dropping it.
      queue.push({ req, res });
      queuedCount += 1;
      maxQueueDepthSeen = Math.max(maxQueueDepthSeen, queue.length);
      return;
    }
    server = fallback;
  }

  dispatch(server, req, res);
}

function dispatch(server, req, res) {
  server.activeConnections += 1;
  server.totalRouted += 1;

  proxy.web(
    req,
    res,
    { target: `http://${server.host}:${server.port}` },
    () => {} // errors handled by proxy 'error' event below
  );

  res.on('finish', () => {
    server.activeConnections -= 1;
    drainQueue();
  });
}

function drainQueue() {
  while (queue.length > 0 && anyServerHasCapacity()) {
    const next = queue.shift();
    routeRequest(next.req, next.res);
  }
}

proxy.on('error', (err, req, res) => {
  res.writeHead(502, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'bad_gateway', message: err.message }));
});

function statsPayload() {
  return {
    strategy: STRATEGY,
    maxConcurrentPerServer: MAX_CONCURRENT_PER_SERVER,
    servers: servers.map((s) => ({
      target: `${s.host}:${s.port}`,
      activeConnections: s.activeConnections,
      totalRouted: s.totalRouted,
    })),
    queue: { currentLength: queue.length, totalEverQueued: queuedCount, maxDepthSeen: maxQueueDepthSeen },
  };
}

function fireInternalBurst(count) {
  // Fires `count` truly-concurrent requests at this same load balancer's
  // own /work route, using Node's non-blocking I/O (not the browser),
  // so the dashboard's "Fire burst" button gets real concurrency
  // regardless of the browser's per-origin connection limits.
  const results = [];
  const requests = Array.from({ length: count }, () => new Promise((resolve) => {
    const req = http.get({ host: 'localhost', port: PORT, path: '/work' }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try {
          const data = JSON.parse(body);
          results.push({ ok: true, servedBy: data.servedBy, delayMs: data.delayMs });
        } catch (e) {
          results.push({ ok: false, message: 'bad response' });
        }
        resolve();
      });
    });
    req.on('error', (err) => {
      results.push({ ok: false, message: err.message });
      resolve();
    });
  }));
  return Promise.all(requests).then(() => results);
}

const server = http.createServer((req, res) => {
  if (req.url === '/' || req.url === '/dashboard') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(dashboardHtml);
    return;
  }

  if (req.url === '/style.css') {
    res.writeHead(200, { 'Content-Type': 'text/css' });
    res.end(dashboardCss);
    return;
  }

  if (req.url === '/stats') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(statsPayload(), null, 2));
    return;
  }

  if (req.url.startsWith('/burst')) {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    const count = Math.max(1, Math.min(500, Number(url.searchParams.get('count')) || 30));
    fireInternalBurst(count).then((results) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ results }));
    });
    return;
  }

  routeRequest(req, res);
});

server.listen(PORT, () => {
  console.log(`Load balancer listening on port ${PORT}`);
  console.log(`Dashboard: http://localhost:${PORT}/`);
  console.log(`Strategy: ${STRATEGY} | Max concurrent/server: ${MAX_CONCURRENT_PER_SERVER}`);
  console.log(`Backend pool: ${servers.map((s) => `${s.host}:${s.port}`).join(', ')}`);
});
