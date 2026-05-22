const { app } = require('electron');

const NEWS_FEEDS = [
  {
    name: '微博热搜',
    type: 'weibo-hot',
    url: 'https://weibo.com/ajax/side/hotSearch',
  },
  {
    name: 'Google News',
    type: 'rss',
    url: 'https://news.google.com/rss?hl=zh-CN&gl=CN&ceid=CN:zh-Hans',
  },
  {
    name: 'BBC 中文',
    type: 'rss',
    url: 'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml',
  },
];
const NEWS_CACHE_TTL_MS = 30 * 60 * 1000;

function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtml(value) {
  return decodeXmlEntities(value)
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function firstXmlValue(block, tagName) {
  const pattern = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = block.match(pattern);
  return match ? stripHtml(match[1]) : '';
}

function parseRssItems(xml, sourceName) {
  return Array.from(String(xml || '').matchAll(/<item\b[\s\S]*?<\/item>/gi))
    .map((match) => {
      const block = match[0];
      const title = firstXmlValue(block, 'title');
      const link = firstXmlValue(block, 'link');
      const pubDate = firstXmlValue(block, 'pubDate');
      return title ? { title, link, pubDate, source: sourceName } : null;
    })
    .filter(Boolean)
    .slice(0, 8);
}

function normalizeHotTopicTitle(value) {
  return stripHtml(value)
    .replace(/^#+|#+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseWeiboHotItems(payload) {
  const list = Array.isArray(payload?.data?.realtime) ? payload.data.realtime : [];
  return list
    .map((item, index) => {
      const title = normalizeHotTopicTitle(item.word_scheme || item.word || item.note || item.name);
      if (!title) return null;
      return {
        title,
        rank: Number(item.rank || item.realpos || index + 1),
        hot: Number(item.num || item.raw_hot || 0),
        tag: item.icon_desc || item.small_icon_desc || '',
        source: '微博热搜',
        kind: 'hot-search',
      };
    })
    .filter(Boolean)
    .slice(0, 12);
}

async function fetchDailyNews(force, { getData, saveData, appendDebugLog }) {
  const petData = getData();
  const now = Date.now();
  const cached = petData.news?.items;
  if (!force && Array.isArray(cached) && cached.length && petData.news?.source === '微博热搜' && now - (petData.news.lastFetchAt || 0) < NEWS_CACHE_TTL_MS) {
    return { ok: true, items: cached, cached: true, source: petData.news.source };
  }

  const errors = [];
  for (const feed of NEWS_FEEDS) {
    try {
      const headers = {
        'User-Agent': feed.type === 'weibo-hot' ? 'Mozilla/5.0 Yoyo hot-search' : `Yoyo/${app.getVersion()} daily-news`,
      };
      if (feed.type === 'weibo-hot') headers.Referer = 'https://weibo.com/';
      const response = await fetch(feed.url, { headers });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const items = feed.type === 'weibo-hot'
        ? parseWeiboHotItems(await response.json())
        : parseRssItems(await response.text(), feed.name);
      if (!items.length) throw new Error('empty feed');
      petData.news = { lastFetchAt: now, items, source: feed.name };
      saveData();
      appendDebugLog('news_fetch', { ok: true, source: feed.name, count: items.length });
      return { ok: true, items, cached: false, source: feed.name };
    } catch (error) {
      errors.push(`${feed.name}: ${error.message}`);
    }
  }

  appendDebugLog('news_fetch', { ok: false, errors });
  if (Array.isArray(cached) && cached.length) {
    return { ok: true, items: cached, cached: true, stale: true, source: petData.news?.source || '' };
  }
  return { ok: false, error: '新闻服务暂时不可用。' };
}

function registerNewsIpc({ ipcMain, getData, saveData, appendDebugLog }) {
  ipcMain.handle('news:get', async (_event, options = {}) => fetchDailyNews(Boolean(options.force), {
    getData,
    saveData,
    appendDebugLog,
  }));
}

module.exports = { fetchDailyNews, registerNewsIpc };
