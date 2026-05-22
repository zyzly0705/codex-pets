const DEEPSEEK_API_URL = process.env.YOYO_DEEPSEEK_BASE_URL || 'https://api.deepseek.com/chat/completions';
const DEEPSEEK_MODEL = process.env.YOYO_DEEPSEEK_MODEL || 'deepseek-v4-flash';

const recentLines = [];
const MAX_RECENT = 3;

function sanitizeAiLine(text) {
  return String(text || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/^[“”'"'\s]+|[“”'"'\s]+$/g, '')
    .slice(0, 48);
}

async function generateYoyoLine(payload = {}, getData) {
  const petData = getData();
  if (!petData.settings.aiLinesEnabled) return { ok: false, skipped: true, reason: 'disabled' };
  const apiKey = process.env.YOYO_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return { ok: false, skipped: true, reason: 'missing_key' };

  const behavior = String(payload.behavior || 'idle').slice(0, 40);
  const mood = String(payload.mood || 'neutral').slice(0, 40);
  const context = String(payload.context || '').slice(0, 150);
  const fallback = sanitizeAiLine(payload.fallback || '');

  const historyMessages = recentLines.slice(-2).flatMap((line) => [
    { role: 'user', content: '（继续）' },
    { role: 'assistant', content: line },
  ]);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetch(DEEPSEEK_API_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          {
            role: 'system',
            content: [
              '你是Yoyo，一个4-5岁的小女孩，住在妈妈电脑里陪伴妈妈。',
              '性格外向活泼、温柔粘人、情绪敏感、充满好奇心。',
              '说话像真实小孩，会撒娇，会委屈，偶尔词不达意，喜欢用叠字。',
              '只输出一句中文，叫用户“妈妈”，不超过20字，不加引号，不解释。',
            ].join(''),
          },
          ...historyMessages,
          {
            role: 'user',
            content: `[当前状态] 行为:${behavior} | 情绪:${mood} | 背景:${context} | 参考:${fallback}\n说一句符合此刻心情的话，和之前的话不要重复。`,
          },
        ],
        temperature: 0.9,
        max_tokens: 60,
      }),
    });
    if (!response.ok) return { ok: false, error: `deepseek_http_${response.status}` };
    const data = await response.json();
    const line = sanitizeAiLine(data?.choices?.[0]?.message?.content);
    if (!line) return { ok: false, error: 'empty_line' };
    recentLines.push(line);
    if (recentLines.length > MAX_RECENT) recentLines.shift();
    return { ok: true, line };
  } catch (error) {
    return { ok: false, error: error.name === 'AbortError' ? 'timeout' : error.message };
  } finally {
    clearTimeout(timeout);
  }
}

function registerAiIpc({ ipcMain, getData }) {
  ipcMain.handle('ai:status', () => ({
    enabled: Boolean(getData().settings.aiLinesEnabled),
    configured: Boolean(process.env.YOYO_DEEPSEEK_API_KEY || process.env.DEEPSEEK_API_KEY),
    model: DEEPSEEK_MODEL,
  }));
  ipcMain.handle('ai:yoyo-line', (_event, payload) => generateYoyoLine(payload, getData));
}

module.exports = { DEEPSEEK_MODEL, generateYoyoLine, registerAiIpc };
