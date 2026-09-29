# Load Balancer Simulator

![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)
![Express](https://img.shields.io/badge/Express-4.19-black)
![License](https://img.shields.io/badge/License-MIT-blue)

A working load balancer built in Node.js that distributes HTTP traffic across multiple backend server nodes, with two selectable routing strategies, a request queue that absorbs traffic bursts, and a live dashboard for watching routing decisions happen in real time.

## Features
- **Round-robin routing** — cycles through backend servers in order
- **Least-connections routing** — sends each request to whichever backend currently has the fewest active requests
- **Request queueing** — when every backend is at its concurrency limit, new requests are queued (not dropped) and drained automatically as capacity frees up
- **Live dashboard** — a real-time web UI showing per-server load, queue depth, and a request log, with a button to fire live burst traffic and watch it get distributed
- **Live stats endpoint** — `/stats` shows per-server load and queue depth in real time (JSON, used by the dashboard and available directly)

## Tech Stack
- Node.js, Express (backend nodes)
- `http-proxy` (request forwarding)
- Plain HTML/CSS/JS dashboard (no framework, no build step)

## Project Structure
```
.
├── backend/server.js            # A single backend server node (simulates variable processing time)
├── loadbalancer/
│   ├── server.js                 # The load balancer: routing strategies + queue + dashboard routes
│   └── public/
│       ├── dashboard.html        # Live dashboard page
│       └── style.css             # Dashboard styling
├── demo/
│   ├── run-demo.js               # Boots everything, fires a 30-request burst, then exits
│   └── start-dashboard.js        # Boots everything and keeps it running until you stop it
└── package.json
```

## Getting Started

### Install
```bash
npm install
```

### Run the dashboard (recommended)
Boots all 3 backend nodes + the load balancer together in one terminal, and keeps them running so you can use the dashboard for as long as you like.
```bash
npm run dashboard
```
Then open **http://localhost:4000/** — you'll see live server load, the queue panel, and a "Fire burst" button. Click it to send real concurrent traffic through the load balancer and watch the bars, queue, and request log update live. Press `Ctrl+C` in the terminal to stop everything cleanly.

### Run the one-shot demo
Boots everything, fires a 30-request burst automatically, prints the results, then shuts down — good for a quick non-interactive proof it works.
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
On Windows PowerShell, set environment variables like this instead:
```powershell
$env:STRATEGY="least-connections"; $env:MAX_CONCURRENT="3"; node loadbalancer/server.js
```

Environment variables for the load balancer:
| Variable | Default | Description |
|---|---|---|
| `STRATEGY` | `round-robin` | `round-robin` or `least-connections` |
| `MAX_CONCURRENT` | `3` | Max concurrent requests allowed per backend before overflow is queued |
| `SERVERS` | `localhost:4001,localhost:4002,localhost:4003` | Comma-separated backend pool |
| `PORT` | `4000` | Port the load balancer listens on |

## The Dashboard
Available at `http://localhost:4000/` whenever the load balancer is running (via `npm run dashboard` or the manual steps above). It polls `/stats` every 500ms and shows:
- Current routing strategy and pool configuration
- Each backend's active connections (live bar) and total requests routed
- The overflow queue's current depth, total requests ever queued, and max depth seen
- A **Fire burst** control that sends real concurrent traffic through the load balancer's own `/work` route (fired server-side, not from the browser, so it isn't limited by browser per-origin connection caps) and logs each result as it completes

## What This Demonstrates
- Applying networking/systems-design concepts (load distribution, connection tracking, backpressure) to a working implementation
- Two distinct routing algorithms and the trade-offs between them (round-robin is simple and fair by request count; least-connections adapts to uneven request processing times)
- Queue-based overflow handling so a traffic burst degrades gracefully (higher latency) instead of failing requests outright
- Building an observability layer (the dashboard) on top of a backend system, not just the backend itself

## Possible Next Steps
- Add a weighted round-robin strategy (some servers get more traffic than others)
- Add health checks that automatically remove an unresponsive backend from rotation
- Let the dashboard switch routing strategy live, instead of only at startup

## License
This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
