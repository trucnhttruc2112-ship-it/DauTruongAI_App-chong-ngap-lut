import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

function parseTrustProxy(val) {
  if (val === undefined || val === null || val === '') return false;
  if (val === 'true') return true;
  if (val === 'false') return false;
  const num = Number(val);
  if (!isNaN(num)) return num;
  return val;
}

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
  AI_ANALYZE_URL: process.env.AI_ANALYZE_URL || '',
  AI_API_KEY: process.env.AI_API_KEY || '',
  AI_TIMEOUT_MS: parseInt(process.env.AI_TIMEOUT_MS || '20000', 10),
  DATA_MODE: process.env.DATA_MODE || 'demo', // 'demo' | 'real'
  ALLOW_DEMO_IN_PROD: process.env.ALLOW_DEMO_IN_PROD === 'true',
  TRUST_PROXY: parseTrustProxy(process.env.TRUST_PROXY),
  PUBLIC_BASE_URL: process.env.PUBLIC_BASE_URL || 'http://localhost:3000',
  ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:3000,http://127.0.0.1:3000'))
    .split(',')
    .map(s => s.trim())
    .filter(Boolean),
});

export function validateEnvironmentConfig(env = ENV) {
  if (env.NODE_ENV === 'production') {
    if (!env.ALLOWED_ORIGINS || env.ALLOWED_ORIGINS.length === 0) {
      throw new Error('Lỗi cấu hình: Môi trường production (NODE_ENV=production) bắt buộc phải cấu hình ALLOWED_ORIGINS hợp lệ.');
    }
    if ((env.AI_MODE === 'mock' || env.DATA_MODE === 'demo') && !env.ALLOW_DEMO_IN_PROD) {
      throw new Error('Lỗi cấu hình: Môi trường production từ chối khởi động khi AI_MODE=mock hoặc DATA_MODE=demo. Đặt ALLOW_DEMO_IN_PROD=true nếu muốn chạy thử nghiệm có chủ ý.');
    }
    if ((env.AI_MODE === 'mock' || env.DATA_MODE === 'demo') && env.ALLOW_DEMO_IN_PROD) {
      console.warn('⚠️ [CẢNH BÁO BẢO MẬT] Môi trường production đang chạy với AI_MODE=mock hoặc DATA_MODE=demo do cờ ALLOW_DEMO_IN_PROD=true!');
    }
  }
  if (env.DATA_MODE === 'real' && env.AI_MODE === 'mock') {
    throw new Error('Lỗi cấu hình: Chế độ dữ liệu thật (DATA_MODE=real) cấm sử dụng AI_MODE=mock.');
  }
}

export default ENV;
