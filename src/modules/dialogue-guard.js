// dialogue-guard.js - keeps AI-generated Yoyo lines short, childlike, and safe

const BLOCKED_PATTERNS = [
  /作为(一个)?AI/u,
  /人工智能/u,
  /我不能/u,
  /恋爱|亲吻|暧昧|老婆|老公/u,
  /命令你|必须|立刻/u,
  /```|<script|<\/script/u,
];

export function guardYoyoLine(line) {
  const cleaned = String(line || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/[“”"']/g, '')
    .replace(/\s+/g, '')
    .trim();
  if (!cleaned) return '';
  if (cleaned.length > 36) return '';
  if (BLOCKED_PATTERNS.some(pattern => pattern.test(cleaned))) return '';
  if (!cleaned.includes('妈妈') && cleaned.length > 8) return `妈妈，${cleaned}`;
  return cleaned;
}
