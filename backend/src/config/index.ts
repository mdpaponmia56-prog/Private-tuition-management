import dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export const config = {
  port: parseInt(process.env.PORT || '5001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  databaseUrl: process.env.DATABASE_URL || '',
  sessionSecret: process.env.SESSION_SECRET || 'fallback-secret-at-least-32-chars-long-security',
  sessionMaxAgeDays: parseInt(process.env.SESSION_MAX_AGE_DAYS || '7', 10),
  storageDir: path.resolve(process.cwd(), process.env.STORAGE_DIR || './uploads'),
  maxPhotoSizeMB: parseInt(process.env.MAX_PHOTO_SIZE_MB || '2', 10),
  
  // Administrator identities
  admin1: {
    email: process.env.ADMIN1_EMAIL || 'teacher.owner@tuition.bd',
    name: process.env.ADMIN1_NAME || 'Lead Instructor (Owner)',
    password: process.env.ADMIN1_PASSWORD || 'Teacher2026@Bangladesh!',
    role: 'OWNER' as const,
  },
  admin2: {
    email: process.env.ADMIN2_EMAIL || 'admin2.coordinator@tuition.bd',
    name: process.env.ADMIN2_NAME || 'Academic Coordinator',
    password: process.env.ADMIN2_PASSWORD || 'Coord2026@Bangladesh!',
    role: 'ADMINISTRATOR_2' as const,
  },
  admin3: {
    email: process.env.ADMIN3_EMAIL || 'admin3.assistant@tuition.bd',
    name: process.env.ADMIN3_NAME || 'Accounts Assistant',
    password: process.env.ADMIN3_PASSWORD || 'Assist2026@Bangladesh!',
    role: 'ADMINISTRATOR_3' as const,
  },
};
