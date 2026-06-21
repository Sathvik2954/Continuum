import { Server as SocketIOServer, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { Call } from '../models/Call';

interface SDPPayload {
  type: 'offer' | 'pranswer' | 'answer' | 'rollback';
  sdp: string;
}

interface ICECandidatePayload {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

interface JWTPayload {
  userId: string;
  role: 'PATIENT' | 'DOCTOR' | 'ADMIN';
  name: string;
}

interface AuthenticatedSocket extends Socket {
  user?: JWTPayload;
}

// In-memory room registry — { callId: Set<socketId> }
// This is fine for a single-instance deployment. If you ever scale to
// multiple server instances, this needs to move to Redis pub/sub.
const rooms = new Map<string, Set<string>>();
const socketToCall = new Map<string, string>(); // socketId -> callId, for cleanup on disconnect

const MAX_PARTICIPANTS_PER_ROOM = 2;

export function setupSignaling(io: SocketIOServer): void {
  // ── Authenticate every socket connection via JWT ────────────────────────────
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      next(new Error('Authentication required'));
      return;
    }

    try {
      const secret = process.env.JWT_SECRET!;
      const payload = jwt.verify(token, secret) as JWTPayload;
      socket.user = payload;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`🔌 Socket connected: ${socket.id} (user: ${socket.user?.name})`);

    // ── join_room ──────────────────────────────────────────────────────────────
    socket.on('join_room', async ({ callId }: { callId: string }) => {
      try {
        if (!socket.user) return;

        // Verify this user is actually a participant on this call
        const call = await Call.findById(callId);
        if (!call) {
          socket.emit('error', { message: 'Call not found' });
          return;
        }

        const isParticipant =
          call.patientId.toString() === socket.user.userId ||
          call.doctorId.toString() === socket.user.userId;

        if (!isParticipant) {
          socket.emit('error', { message: 'You are not a participant on this call' });
          return;
        }

        // Enforce max 2 participants per room
        const room = rooms.get(callId) ?? new Set<string>();
        if (room.size >= MAX_PARTICIPANTS_PER_ROOM && !room.has(socket.id)) {
          socket.emit('error', { message: 'This call room is full' });
          return;
        }

        room.add(socket.id);
        rooms.set(callId, room);
        socketToCall.set(socket.id, callId);

        socket.join(callId);

        // Notify the OTHER peer (if already in the room) that someone joined
        socket.to(callId).emit('peer_joined', {
          userId: socket.user.userId,
          role: socket.user.role,
        });

        // Update call status
        const newStatus = socket.user.role === 'PATIENT' ? 'PATIENT_JOINED' : 'DOCTOR_JOINED';
        if (call.status === 'SCHEDULED' || call.status === 'CONFIRMED') {
          call.status = newStatus;
        } else if (
          (call.status === 'PATIENT_JOINED' && socket.user.role === 'DOCTOR') ||
          (call.status === 'DOCTOR_JOINED' && socket.user.role === 'PATIENT')
        ) {
          call.status = 'ACTIVE';
          call.startedAt = call.startedAt ?? new Date();
        }
        await call.save();

        console.log(`👤 ${socket.user.name} joined room ${callId} (${room.size}/${MAX_PARTICIPANTS_PER_ROOM})`);
      } catch (err) {
        console.error('join_room error:', err);
        socket.emit('error', { message: 'Failed to join room' });
      }
    });

    // ── WebRTC signaling relay — these three just forward messages
    //    between the two peers in the room. The server never inspects
    //    or modifies SDP/ICE content. ───────────────────────────────────────────

    socket.on('sdp_offer', ({ callId, sdp }: { callId: string; sdp: SDPPayload }) => {
      socket.to(callId).emit('sdp_offer', { sdp });
    });

    socket.on('sdp_answer', ({ callId, sdp }: { callId: string; sdp: SDPPayload }) => {
      socket.to(callId).emit('sdp_answer', { sdp });
    });

    socket.on('ice_candidate', ({ callId, candidate }: { callId: string; candidate: ICECandidatePayload }) => {
      socket.to(callId).emit('ice_candidate', { candidate });
    });

    // ── call_ended — either party can end the call for both ───────────────────

    socket.on('call_ended', async ({ callId }: { callId: string }) => {
      try {
        socket.to(callId).emit('call_ended');

        const call = await Call.findById(callId);
        if (call && call.status !== 'ENDED') {
          call.status = 'ENDED';
          call.endedAt = new Date();
          await call.save();
        }

        cleanupRoom(callId);
      } catch (err) {
        console.error('call_ended error:', err);
      }
    });

    // ── disconnect — cleanup + notify peer ─────────────────────────────────────

    socket.on('disconnect', () => {
      const callId = socketToCall.get(socket.id);
      if (callId) {
        const room = rooms.get(callId);
        room?.delete(socket.id);
        socket.to(callId).emit('peer_left', { userId: socket.user?.userId });

        if (room && room.size === 0) {
          rooms.delete(callId);
        }
        socketToCall.delete(socket.id);
      }
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
}

function cleanupRoom(callId: string): void {
  const room = rooms.get(callId);
  if (room) {
    for (const socketId of room) {
      socketToCall.delete(socketId);
    }
    rooms.delete(callId);
  }
}
