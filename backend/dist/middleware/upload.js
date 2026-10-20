import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { config } from '../config/index.js';
const photoDir = path.join(config.storageDir, 'photos');
try {
    if (!fs.existsSync(photoDir)) {
        fs.mkdirSync(photoDir, { recursive: true });
    }
}
catch (err) {
    console.warn('[Storage] Warning initializing photo directory:', err.message);
}
const storage = multer.diskStorage({
    destination: (_req, _file, cb) => {
        try {
            if (!fs.existsSync(photoDir)) {
                fs.mkdirSync(photoDir, { recursive: true });
            }
        }
        catch { }
        cb(null, photoDir);
    },
    filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const unique = crypto.randomBytes(16).toString('hex');
        cb(null, `student_${unique}${ext}`);
    },
});
const allowedMimes = ['image/jpeg', 'image/png', 'image/webp'];
export const uploadStudentPhoto = multer({
    storage,
    limits: {
        fileSize: config.maxPhotoSizeMB * 1024 * 1024,
    },
    fileFilter: (_req, file, cb) => {
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error('Invalid image format. Only JPEG, PNG, and WebP files are allowed.'));
        }
    },
});
