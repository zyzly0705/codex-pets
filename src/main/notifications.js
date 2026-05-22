// notifications.js - 系统级通知：需求低提醒 + 每日唤醒
const { Notification, app } = require('electron');

// 每日唤醒通知冷却：每天只推一次
let lastDailyNotifDate = '';
// 需求低通知冷却：30 分钟内不重复
let lastNeedNotifTime = 0;
const NEED_NOTIF_COOLDOWN = 30 * 60 * 1000;
// 需求低阈值
const NEED_LOW_THRESHOLD = 30;

const DAILY_LINES = [
  ['Yoyo 在等你 🌸', 'Yoyo 一直在小屋等你，来陪陪她吧～'],
  ['早安！Yoyo 想你了 ☀️', '新的一天开始了，Yoyo 想和你打个招呼～'],
  ['Yoyo 在想你呢 💭', '好久没见啦，快来看看 Yoyo 吧～'],
  ['今天也要元气满满哦 ✨', 'Yoyo 已经准备好陪伴你了！'],
];

const NEED_LINES = {
  satiety: ['Yoyo 肚子咕咕叫啦 🍎', 'Yoyo 有点饿了，能喂她吃点东西吗？'],
  cleanliness: ['Yoyo 想洗香香 🛁', 'Yoyo 身上有点脏脏的，想洗个澡～'],
  mood: ['Yoyo 有点低落 💙', 'Yoyo 心情不太好，能陪陪她吗？'],
  energy: ['Yoyo 困到眼皮打架了 😴', 'Yoyo 已经很累了，让她休息一下吧～'],
  urgent: ['Yoyo 很需要你 😢', 'Yoyo 的状态很不好，快来照顾她吧！'],
};

function canNotify() {
  return Notification.isSupported();
}

function todayKey() {
  return new Date().toDateString();
}

function sendNotification(title, body, onClick) {
  if (!canNotify()) return;
  try {
    const n = new Notification({
      title,
      body,
      silent: false,
    });
    if (onClick) n.on('click', onClick);
    n.show();
  } catch (e) {
    // 通知发送失败不影响主流程
  }
}

function tryDailyNotification(openHome) {
  const today = todayKey();
  if (lastDailyNotifDate === today) return;
  // 只在 8:00–20:00 之间推
  const hour = new Date().getHours();
  if (hour < 8 || hour >= 20) return;

  lastDailyNotifDate = today;
  const [title, body] = DAILY_LINES[Math.floor(Math.random() * DAILY_LINES.length)];
  sendNotification(title, body, () => {
    openHome?.();
    // 点击通知后聚焦 app
    app.focus?.({ steal: true });
  });
}

function tryNeedNotification(life, openHome) {
  const now = Date.now();
  if (now - lastNeedNotifTime < NEED_NOTIF_COOLDOWN) return;

  // urgent 优先
  if (life.status === 'urgent') {
    lastNeedNotifTime = now;
    const [title, body] = NEED_LINES.urgent;
    sendNotification(title, body, () => { openHome?.(); app.focus?.({ steal: true }); });
    return;
  }

  // 找最低需求
  const needs = ['satiety', 'cleanliness', 'mood', 'energy'];
  let lowestKey = null;
  let lowestVal = Infinity;
  for (const key of needs) {
    const val = Number(life[key] ?? 100);
    if (val < lowestVal) { lowestVal = val; lowestKey = key; }
  }

  if (lowestVal <= NEED_LOW_THRESHOLD && lowestKey && NEED_LINES[lowestKey]) {
    lastNeedNotifTime = now;
    const [title, body] = NEED_LINES[lowestKey];
    sendNotification(title, body, () => { openHome?.(); app.focus?.({ steal: true }); });
  }
}

// 启动定时检查：每 5 分钟检查一次需求，每 30 分钟检查每日唤醒
function startNotificationScheduler({ getData, openHome }) {
  // 每 5 分钟检查需求
  setInterval(() => {
    const life = getData()?.life;
    if (!life) return;
    tryNeedNotification(life, openHome);
  }, 5 * 60 * 1000);

  // 每 30 分钟检查每日唤醒（启动后 10 秒先检查一次）
  setTimeout(() => tryDailyNotification(openHome), 10000);
  setInterval(() => tryDailyNotification(openHome), 30 * 60 * 1000);
}

module.exports = { startNotificationScheduler };
