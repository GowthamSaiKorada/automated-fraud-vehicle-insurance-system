const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_ROOT = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
const CLAIMS_UPLOAD_DIR = path.join(UPLOAD_ROOT, 'claims');
fs.mkdirSync(CLAIMS_UPLOAD_DIR, { recursive: true });

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png']);
const MAX_FILE_SIZE_BYTES = (Number(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, CLAIMS_UPLOAD_DIR);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.jpg';
    const uniqueName = `claim_${Date.now()}_${crypto.randomBytes(6).toString('hex')}${safeExt}`;
    cb(null, uniqueName);
  },
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  if (!ALLOWED_EXTENSIONS.has(ext) || !ALLOWED_MIME_TYPES.has(mime)) {
    return cb(new Error('Invalid file type. Only JPG, JPEG, and PNG images are permitted.'));
  }
  cb(null, true);
}

const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1,
  },
});

function verifyImageMagicBytes(filePath) {
  const fd = fs.openSync(filePath, 'r');
  try {
    const buffer = Buffer.alloc(8);
    const bytesRead = fs.readSync(fd, buffer, 0, 8, 0);
    if (bytesRead < 4) return false;

    const isJpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const isPng =
      bytesRead >= 8 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a;

    return isJpeg || isPng;
  } finally {
    fs.closeSync(fd);
  }
}

module.exports = {
  UPLOAD_ROOT,
  CLAIMS_UPLOAD_DIR,
  MAX_FILE_SIZE_BYTES,
  uploadMiddleware,
  verifyImageMagicBytes,
};
