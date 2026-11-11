// Ảnh minh họa hiện trường dạng SVG cho bản demo (không dùng ảnh người thật / biển số).
// Mỗi ảnh chỉ là hình vẽ đơn giản, đủ để thể hiện bố cục giao diện.

const WATER_LEVEL = { none: 0, light: 0.18, moderate: 0.32, severe: 0.48, unknown: 0.22 }

export function scenePhoto(level = 'moderate', variant = 0) {
  const w = 480
  const h = 320
  const ratio = WATER_LEVEL[level] ?? 0.25
  const waterTop = Math.round(h - h * ratio - 40)
  const blur = level === 'unknown' ? '<filter id="b"><feGaussianBlur stdDeviation="6"/></filter>' : ''
  const filterAttr = level === 'unknown' ? ' filter="url(#b)"' : ''
  const hues = [
    ['#8aa0b8', '#c7d3e0', '#6b7c8f', '#9fb0c2'],
    ['#7f93a8', '#bccada', '#5f6f82', '#a5b5c6'],
    ['#94a7bb', '#d0dae6', '#738497', '#aab9c9']
  ][variant % 3]

  const buildings = [
    [20, 90, 90, 150], [120, 60, 70, 180], [200, 110, 110, 130],
    [320, 70, 80, 170], [410, 100, 60, 140]
  ].map(([x, y, bw, bh], i) =>
    `<rect x="${x}" y="${y}" width="${bw}" height="${bh}" fill="${i % 2 ? hues[2] : hues[3]}"/>` +
    Array.from({ length: 3 }, (_, r) =>
      `<rect x="${x + 12}" y="${y + 18 + r * 34}" width="${bw - 24}" height="14" fill="#e6edf5" opacity="0.55"/>`
    ).join('')
  ).join('')

  const rain = Array.from({ length: 26 }, (_, i) => {
    const x = (i * 37 + variant * 13) % w
    const y = (i * 53) % 200
    return `<line x1="${x}" y1="${y}" x2="${x - 6}" y2="${y + 18}" stroke="#ffffff" stroke-opacity="0.45" stroke-width="2"/>`
  }).join('')

  const water = ratio > 0
    ? `<rect x="0" y="${waterTop}" width="${w}" height="${h - waterTop}" fill="#6b7f6a" opacity="0.82"/>
       <path d="M0 ${waterTop} q40 -8 80 0 t80 0 t80 0 t80 0 t80 0 t80 0" fill="none" stroke="#dfe8e0" stroke-opacity="0.7" stroke-width="3"/>`
    : ''

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
  <defs>${blur}<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hues[0]}"/><stop offset="1" stop-color="${hues[1]}"/></linearGradient></defs>
  <g${filterAttr}>
    <rect width="${w}" height="${h}" fill="url(#s)"/>
    ${buildings}
    <rect x="0" y="240" width="${w}" height="80" fill="#4b5563"/>
    <rect x="0" y="276" width="${w}" height="4" fill="#e5e7eb" opacity="0.6"/>
    <g transform="translate(250 228)">
      <circle cx="0" cy="40" r="22" fill="#1f2937"/><circle cx="74" cy="40" r="22" fill="#1f2937"/>
      <path d="M0 40 L30 6 L64 6 L74 40" fill="none" stroke="#374151" stroke-width="7"/>
    </g>
    ${water}
    ${rain}
  </g>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
