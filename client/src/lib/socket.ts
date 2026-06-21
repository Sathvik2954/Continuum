import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_ORIGIN || 'http://localhost:3001';

let socket: Socket | null = null;

/**
 * Returns a singleton Socket.io client connection, authenticated with the
 * current JWT. Call disconnectSocket() when leaving a call room to free
 * the connection cleanly.
 */
export function getSocket(): Socket {
  if (socket && socket.connected) return socket;

  const token = localStorage.getItem('continuum_token');

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
