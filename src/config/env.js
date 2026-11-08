import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const ENV = Object.freeze({
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3000', 10),
  DB_PATH: process.env.NODE_ENV === 'test'
    ? (process.env.TEST_DB_PATH || ':memory:')
    : (process.env.DB_PATH || './data/dongnai_flood.sqlite'),
  UPLOAD_DIR: process.env.NODE_ENV === 'test'
    ? (process.env.TEST_UPLOAD_DIR || './uploads_test_tmp')
    : (process.env.UPLOAD_DIR || './uploads'),
  AI_MODE: process.env.AI_MODE || 'mock', // 'mock' | 'local' | 'remote'
  DATA_MODE: process.env.DATA_MODE || 'demo', // 'demo' | 'real'
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
});

export default ENV;
