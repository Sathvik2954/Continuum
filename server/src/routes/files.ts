import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import verifyToken from '../middleware/auth';
import { assertPatientAccess } from '../middleware/patientAccess';
import Consultation from '../models/Consultation';
import Document from '../models/Document';

const router = Router();

// Ensure the local uploads directory exists
const UPLOADS_DIR = path.join(__dirname, '../../../uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB maximum file size
  },
});

// POST /api/files/upload - Handle binary uploads
router.post('/upload', verifyToken, upload.single('file'), (req: Request, res: Response) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file attachment received' });
  }

  // Return dynamic URL that must be fetched through Express stream endpoint
  const url = `/api/files/stream/${req.file.filename}`;
  return res.status(200).json({
    success: true,
    url,
    filename: req.file.filename,
    sizeKb: Math.round(req.file.size / 1024),
  });
});

// GET /api/files/stream/:filename - Secure streaming of static files
router.get('/stream/:filename', verifyToken, async (req: Request, res: Response) => {
  const { filename } = req.params;
  const filePath = path.join(UPLOADS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Requested file not found on disk' });
  }

  try {
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Check relationship access to this file
    let patientId: string | null = null;
    const streamUrlPath = `/api/files/stream/${filename}`;

    // 1. Check if it is a consultation symptom audio or response audio
    const consultation = await Consultation.findOne({
      $or: [
        { symptomAudioUrl: streamUrlPath },
        { doctorResponseAudioUrl: streamUrlPath },
        { callRecordingUrl: streamUrlPath }
      ]
    });

    if (consultation) {
      patientId = consultation.patientId.toString();
    } else {
      // 2. Check if it is a medical document
      const document = await Document.findOne({ fileUrl: streamUrlPath });
      if (document) {
        patientId = document.patientId.toString();
      }
    }

    // 3. Assert relationship access
    if (patientId) {
      const isAuthorized = await assertPatientAccess(userId, patientId, userRole);
      if (!isAuthorized) {
        return res.status(403).json({ error: 'Forbidden: You do not have access to this clinical file' });
      }
    } else {
      // If the record does not exist yet (during sync upload phase), we allow read if they are authenticated.
      // (This handles temporary files or files uploaded but not yet referenced by synced documents)
      // We will still confirm they are authenticated (done by verifyToken middleware).
    }

    // Stream file contents safely
    res.sendFile(filePath);
  } catch (error) {
    console.error('File stream security assertion failed:', error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;
