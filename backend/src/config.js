export function readConfig(env = process.env) {
  const integer = (name, fallback, max) => {
    const value = env[name]?.trim() || String(fallback);
    if (!/^\d+$/.test(value) || Number(value) < 1 || Number(value) > max) {
      throw new Error(`Cấu hình ${name} phải là số nguyên từ 1 đến ${max}.`);
    }
    return Number(value);
  };
  const mock = env.MOCK_GEMINI?.trim().toLowerCase() || 'false';
  if (!['true', 'false'].includes(mock)) {
    throw new Error('Cấu hình MOCK_GEMINI phải là true hoặc false.');
  }
  const origins = (env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://localhost:3000')
    .split(',').map(value => value.trim()).filter(Boolean);
  const allowedOrigins = origins.map(value => {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
          url.search || url.hash || url.pathname !== '/') throw new Error();
      return url.origin;
    } catch {
      throw new Error('ALLOWED_ORIGINS phải gồm các HTTP(S) origin, cách nhau bằng dấu phẩy.');
    }
  });
  return {
    port: integer('PORT', 3001, 65535),
    apiKey: env.GEMINI_API_KEY?.trim() || '',
    model: env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite',
    mock: mock === 'true',
    timeoutMs: integer('GEMINI_TIMEOUT_MS', 30000, 120000),
    allowedOrigins: [...new Set(allowedOrigins)],
  };
}
