const fs = require('fs');
const path = require('path');
const multer = require('multer');

const uploadDir = path.join(__dirname, '../../uploads/results');
const MAX_RESULT_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png'];
const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png'];
const INVALID_TYPE_MESSAGE = 'ອັບໂຫຼດໄດ້ສະເພາະໄຟລ໌ JPG ຫຼື PNG ເທົ່ານັ້ນ';
const INVALID_CONTENT_MESSAGE = 'ໄຟລ໌ຮູບບໍ່ຖືກຕ້ອງ ກະລຸນາໃຊ້ JPG ຫຼື PNG';
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  },
});

const fileFilter = (_req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype) || !ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error(INVALID_TYPE_MESSAGE));
  }

  cb(null, true);
};

function isJpeg(buffer) {
  return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
}

function isPng(buffer) {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  );
}

function validateUploadedResultImage(file) {
  if (!file?.path) return null;
  const header = fs.readFileSync(file.path, { encoding: null, flag: 'r' }).subarray(0, 8);
  const valid = file.mimetype === 'image/jpeg' ? isJpeg(header) : isPng(header);
  return valid ? null : INVALID_CONTENT_MESSAGE;
}

function cleanupUploadedResultImage(file) {
  if (!file?.path) return;
  fs.unlink(file.path, (err) => {
    if (err && err.code !== 'ENOENT') {
      console.error('Cleanup invalid result image failed:', err.message);
    }
  });
}

const resultImageUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_RESULT_IMAGE_SIZE },
});

resultImageUpload.validateUploadedResultImage = validateUploadedResultImage;
resultImageUpload.cleanupUploadedResultImage = cleanupUploadedResultImage;
resultImageUpload.messages = {
  tooLarge: 'ຂະໜາດຮູບຕ້ອງບໍ່ເກີນ 5MB',
  invalidType: INVALID_TYPE_MESSAGE,
  invalidContent: INVALID_CONTENT_MESSAGE,
};

module.exports = resultImageUpload;
