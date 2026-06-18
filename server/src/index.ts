import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './lib/db';

// Load environment variables
dotenv.config();

// Initialize Database connection
connectDB();

const app = express();
const server = http.createServer(app);

// Setup Socket.io signaling server
const io = new Server(server, {
  cors: {
    origin: '*', // In development, allow all origins
    methods: ['GET', 'POST'],
  },
});

// Express middleware
app.use(cors());
app.use(express.json());

import cron from 'node-cron';
import PatientDoctorLink from './models/PatientDoctorLink';

// Routes
import authRouter from './routes/auth';
import patientsRouter from './routes/patients';
import doctorsRouter from './routes/doctors';
import syncRouter from './routes/sync';
import filesRouter from './routes/files';
import connectionsRouter from './routes/connections';
import consultationsRouter from './routes/consultations';
import callsRouter from './routes/calls';
import adminRouter from './routes/admin';
import followupsRouter from './routes/followups';

app.use('/api/auth', authRouter);
app.use('/api/patients', patientsRouter);
app.use('/api/doctors', doctorsRouter);
app.use('/api/sync', syncRouter);
app.use('/api/files', filesRouter);
app.use('/api/connections', connectionsRouter);
app.use('/api/consultations', consultationsRouter);
app.use('/api/calls', callsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/followups', followupsRouter);

// Daily cron job running at midnight (00:00) to flag expired PENDING requests (FR-11)
cron.schedule('0 0 * * *', async () => {
  console.log('Running daily cron job to expire pending connection requests...');
  try {
    const now = new Date();
    const result = await PatientDoctorLink.updateMany(
      { status: 'PENDING', expiresAt: { $lte: now } },
      { $set: { status: 'EXPIRED' } }
    );
    console.log(`Cron completed: Expired ${result.modifiedCount} pending link requests.`);
  } catch (error) {
    console.error('Cron job connection request expiry failed:', error);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date() });
});

// Socket.io WebRTC Signaling Rooms
io.on('connection', (socket) => {
  console.log(`Socket connected: ${socket.id}`);

  // Join a consultation WebRTC room
  socket.on('join_room', ({ callId, userId, role }) => {
    socket.join(callId);
    console.log(`User ${userId} (${role}) joined call room ${callId}`);
    
    // Broadcast peer arrival to others in the room
    socket.to(callId).emit('peer_joined', { userId, role });
  });

  // Relay SDP offer
  socket.on('sdp_offer', ({ callId, sdp }) => {
    socket.to(callId).emit('sdp_offer', { sdp });
  });

  // Relay SDP answer
  socket.on('sdp_answer', ({ callId, sdp }) => {
    socket.to(callId).emit('sdp_answer', { sdp });
  });

  // Relay ICE candidate
  socket.on('ice_candidate', ({ callId, candidate }) => {
    socket.to(callId).emit('ice_candidate', { candidate });
  });

  // Notify call hangup
  socket.on('call_ended', ({ callId }) => {
    socket.to(callId).emit('call_ended');
    console.log(`Call room ${callId} ended by peer`);
  });

  socket.on('disconnect', () => {
    console.log(`Socket disconnected: ${socket.id}`);
  });
});

// Start the server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Continuum V3 Server running on port ${PORT}`);
});
