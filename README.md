# Load Balancer Simulator

A working load balancer built in Node.js that distributes HTTP traffic across multiple backend server nodes, with two selectable routing strategies and a request queue that absorbs traffic bursts.

## Features
- **Round-robin routing** — cycles through backend servers in order
- **Least-connections routing** — sends each request to whichever backend currently has the fewest active requests
- **Request queueing** — when every backend is at its concurrency limit, new requests are queued (not dropped) and drained automatically as capacity frees up
- **Live stats endpoint** — `/stats` shows per-server load and queue depth in real time

## Tech Stack
- Node.js, Express (backend nodes)
- `http-proxy` (request forwarding)

## Project Structure
```
.
├── backend/server.js       # A single backend server node (simulates variable processing time)
├── loadbalancer/server.js  # The load balancer: routing strategies + queue
├── demo/run-demo.js        # Boots everything and fires a 30-request burst to prove it works
└── package.json
```

## Getting Started

### Install
```bash
npm install
```

### Run the full demo (recommended)
Boots 3 backend nodes + the load balancer, then fires 30 concurrent requests at it — you'll see requests get distributed, some get queued when the pool is saturated, and all 30 eventually complete successfully.
```bash
npm run demo
```

### Run manually
```bash
# Terminal 1-3: start three backend nodes
node backend/server.js 4001
node backend/server.js 4002
node backend/server.js 4003

# Terminal 4: start the load balancer
STRATEGY=least-connections MAX_CONCURRENT=3 node loadbalancer/server.js

# Terminal 5: send traffic
curl http://localhost:4000/work
curl http://localhost:4000/stats
```

Environment variables for the load balancer:
| Variable | Default | Description |
|---|---|---|
| `STRATEGY` | `round-robin` | `round-robin` or `least-connections` |
| `MAX_CONCURRENT` | `3` | Max concurrent requests allowed per backend before overflow is queued |
| `SERVERS` | `localhost:4001,localhost:4002,localhost:4003` | Comma-separated backend pool |
| `PORT` | `4000` | Port the load balancer listens on |

## What This Demonstrates
- Applying networking/systems-design concepts (load distribution, connection tracking, backpressure) to a working implementation
- Two distinct routing algorithms and the trade-offs between them (round-robin is simple and fair by request count; least-connections adapts to uneven request processing times)
- Queue-based overflow handling so a traffic burst degrades gracefully (higher latency) instead of failing requests outright

## Possible Next Steps
- Add a weighted round-robin strategy (some servers get more traffic than others)
- Add health checks that automatically remove an unresponsive backend from rotation
- Visualise live stats in a small dashboard instead of raw JSON
