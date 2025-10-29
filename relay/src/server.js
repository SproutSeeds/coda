import http from 'node:http';
import { WebSocketServer } from 'ws';
import { jwtVerify } from 'jose';

const PORT = Number(process.env.PORT || 8080);
const SECRET = process.env.DEVMODE_JWT_SECRET || '';
const APP_BASE_URL = process.env.APP_BASE_URL || '';
const RELAY_INTERNAL_SECRET = process.env.RELAY_INTERNAL_SECRET || '';

if (!SECRET) {
  console.error('Missing DEVMODE_JWT_SECRET');
}

function toUint8(s) { return new TextEncoder().encode(s); }

async function verify(token) {
  if (!token) throw new Error('missing token');
  const { payload } = await jwtVerify(token, toUint8(SECRET));
  return payload;
}

// In-memory connection maps
const runners = new Map(); // runnerId -> { ws, userId }
const sessions = new Map(); // sessionId -> { client, runnerId }

const server = http.createServer((req, res) => {
  res.statusCode = 200;
  res.setHeader('content-type', 'text/plain');
  res.end('OK');
});

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', async (req, socket, head) => {
  try {
    const url = new URL(req.url || '/', 'http://localhost');
    const pathname = url.pathname;
    if (pathname !== '/runner' && pathname !== '/client') {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws._path = pathname;
      ws._qs = url.searchParams;
      wss.emit('connection', ws, req);
    });
  } catch {
    try { socket.destroy(); } catch {}
  }
});

function safeJson(data) {
  try { return JSON.parse(typeof data === 'string' ? data : data.toString()); } catch { return null; }
}

function send(ws, obj) {
  try { if (ws.readyState === 1) ws.send(JSON.stringify(obj)); } catch {}
}

wss.on('connection', async (ws) => {
  if (ws._path === '/runner') {
    const token = ws._qs.get('token');
    let payload;
    try { payload = await verify(token); } catch { ws.close(1008, 'unauthorized'); return; }
    const runnerId = String(payload.runnerId || '');
    const userId = String(payload.userId || '');
    const jti = String(payload.jti || '');
    if (!runnerId || !userId) { ws.close(1008, 'invalid runner claims'); return; }
    // Optional revocation check with app
    if (APP_BASE_URL && RELAY_INTERNAL_SECRET && jti) {
      try {
        const res = await fetch(`${APP_BASE_URL}/api/devmode/tokens/runner/verify?jti=${encodeURIComponent(jti)}`, {
          headers: { 'x-relay-secret': RELAY_INTERNAL_SECRET },
        });
        if (!res.ok) { ws.close(1008, 'verify failed'); return; }
        const data = await res.json();
        if (!data?.active) { ws.close(1008, 'revoked'); return; }
      } catch {
        ws.close(1008, 'verify error');
        return;
      }
    }
    runners.set(runnerId, { ws, userId });
    ws.on('close', () => { runners.delete(runnerId); });
    ws.on('message', (data) => {
      const msg = safeJson(data);
      if (!msg || typeof msg.sessionId !== 'string') return;
      const sid = msg.sessionId;
      const s = sessions.get(sid);
      if (!s || s.runnerId !== runnerId) return;
      // Forward everything to the client
      send(s.client, msg);
    });
    return;
  }

  // /client
  const token = ws._qs.get('token');
  let payload;
  try { payload = await verify(token); } catch { ws.close(1008, 'unauthorized'); return; }
  const { type, sessionId, userId, runnerId, projectRoot, sessionSlot } = payload;
  if (type !== 'client' || !sessionId || !userId) { ws.close(1008, 'invalid session claims'); return; }
  // Find a runner either by explicit runnerId or by user match
  let runnerEntry = null;
  if (runnerId && runners.has(runnerId)) {
    runnerEntry = { id: runnerId, ...runners.get(runnerId) };
  } else {
    for (const [rid, r] of runners) {
      if (r.userId === userId) { runnerEntry = { id: rid, ...r }; break; }
    }
  }
  if (!runnerEntry) { ws.close(1013, 'no runner available'); return; }
  sessions.set(String(sessionId), { client: ws, runnerId: runnerEntry.id });
  ws.on('close', () => { sessions.delete(String(sessionId)); });
  // Tell runner to open session
  const openMessage = { type: 'session-open', sessionId: String(sessionId) };
  if (projectRoot && typeof projectRoot === 'string' && projectRoot.trim() !== '') {
    openMessage.cwd = projectRoot;
  }
  if (sessionSlot && typeof sessionSlot === 'string' && sessionSlot.trim() !== '') {
    openMessage.sessionSlot = sessionSlot;
  }
  send(runnerEntry.ws, openMessage);
  ws.on('message', (data) => {
    // Forward to runner as JSON envelope
    const msg = safeJson(data);
    if (msg && typeof msg.type === 'string') {
      send(runnerEntry.ws, { sessionId: String(sessionId), ...msg });
      return;
    }
    // Raw text → stdin
    const text = typeof data === 'string' ? data : data.toString();
    send(runnerEntry.ws, { type: 'stdin', sessionId: String(sessionId), data: text });
  });
});

server.listen(PORT, () => {
  console.log(`Relay listening on :${PORT}`);
});
