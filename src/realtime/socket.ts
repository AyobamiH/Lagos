import { io, Socket } from 'socket.io-client';
import { API_BASE } from '../api/client';

let socket: Socket | null = null;
let lastConnectAttempt = 0;
let retryCount = 0;
const MAX_RETRIES = 8;

function scheduleReconnect(token: string) {
  if (retryCount >= MAX_RETRIES) return;
  const base = 500 * Math.pow(2, retryCount); // exponential
  const jitter = Math.random() * 300;
  const delay = Math.min(10000, base + jitter);
  retryCount++;
  setTimeout(() => {
    try { connectSocket(token); } catch { /* ignored */ }
  }, delay);
}

export function connectSocket(token: string) {
  if (socket) return socket;
  const base = API_BASE.replace(/\/api\/v1$/, '');
  lastConnectAttempt = Date.now();
  socket = io(base, { auth: { token }, reconnection: false, transports:['websocket','polling'] });
  socket.on('connect', () => { retryCount = 0; });
  socket.on('disconnect', () => { scheduleReconnect(token); });
  return socket;
}

export function getSocket() { return socket; }
export function disconnectSocket() { if (socket) { socket.disconnect(); socket = null; } }
export function wasRecentlyTried(ms=10000) { return Date.now() - lastConnectAttempt < ms; }
