import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { connectDB } from './lib/db';
import { startExpiryCron } from './lib/expiryCron';
import { setupSignaling } from './socket/signaling';
import authRoutes from './routes/auth';
import patientRoutes from './routes/patients';
import connectionRoutes from './routes/connections';
import doctorRoutes from './routes/doctors';
import consultationRoutes from './routes/consultations';
import conditionRoutes from './routes/conditions';
import timelineRoutes from './routes/timeline';
import documentRoutes from './routes/documents';
import vitalRoutes from './routes/vitals';
import followupRoutes from './routes/followups';
import callRoutes from './routes/calls';
import analyticsRoutes from './routes/analytics';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const httpServer = http.createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: { origin: CLIENT_ORIGIN, credentials: true },
});
setupSignaling(io);

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use('/api/auth',          authRoutes);
app.use('/api/patients',      patientRoutes);
app.use('/api/connections',   connectionRoutes);
app.use('/api/doctors',       doctorRoutes);
app.use('/api/consultations', consultationRoutes);
app.use('/api',               conditionRoutes);
app.use('/api/patients',      timelineRoutes);
app.use('/api/documents',     documentRoutes);
app.use('/api/vitals',        vitalRoutes);
app.use('/api/followups',     followupRoutes);
app.use('/api/calls',         callRoutes);
app.use('/api/analytics',     analyticsRoutes);
app.use('/api/admin',         adminRoutes);

app.get('/', (_, res) => {
  res.json({
    message: 'CONTINUUM API Server is fully operational.',
    healthCheck: '/api/health',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/admin/storage', (_, res) => {
  try {
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      res.json({ totalFiles: 0, totalSizeMb: 0 });
      return;
    }
    let totalFiles = 0;
    let totalBytes = 0;
    const walk = (dir: string) => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(fullPath);
        else { totalFiles += 1; totalBytes += fs.statSync(fullPath).size; }
      }
    };
    walk(uploadsDir);
    res.json({ totalFiles, totalSizeMb: Math.round((totalBytes / (1024 * 1024)) * 100) / 100 });
  } catch {
    res.status(500).json({ error: 'Failed to compute storage usage' });
  }
});

app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

const start = async () => {
  await connectDB();
  startExpiryCron();
  httpServer.listen(PORT, () => {
    console.log(`🚀 CONTINUUM server (HTTP + Socket.io) running on http://localhost:${PORT}`);
  });
};

start();
