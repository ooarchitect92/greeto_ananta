'use strict';
import { io } from 'socket.io-client';

export function connectSocket({ userId, teamIds, token }) {
  const socket = io('/', {
    path: '/socket.io',
    auth: { token, userId, teamIds },
    timeout: 10000,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    // The polling transport's handshake is a sequence of independent HTTP
    // requests that must all land on the same in-memory session — behind
    // Cloudflare (in front of this app) that sequence intermittently breaks
    // ("Session ID unknown"), forcing a fresh reconnect loop and silently
    // dropping real-time updates until the next successful handshake.
    // WebSocket is one persistent connection with no equivalent failure
    // mode, so skip polling — including its own upgrade attempt — entirely.
    transports: ['websocket'],
  });
  return socket;
}
