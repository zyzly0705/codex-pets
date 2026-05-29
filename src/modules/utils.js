// utils.js - 纯工具函数

export function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

export function lerp(a, b, t) {
  return a + (b - a) * Math.min(1, t);
}

export function localFileUrl(filePath) {
  const normalizedPath = String(filePath || '').replaceAll('\\', '/');
  const withLeadingSlash = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  return encodeURI(`file://${withLeadingSlash}`);
}
