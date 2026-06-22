import multer from 'multer';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'calls');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || '.webm';
    cb(null, `call-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowed = ['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'];
  if (allowed.includes(file.mimetype)) cb(null, true);
  else cb(new Error(`Unsupported audio format: ${file.mimetype}`));
};

export const callRecordingUpload = multer({
  storage,
  fileFilter,
  // Calls can run up to 60 minutes - generous cap vs the 10MB on async audio
  limits: { fileSize: 25 * 1024 * 1024 },
});
