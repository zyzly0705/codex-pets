const { BrowserWindow } = require('electron');
const { CARE_ACTIONS, DECAY_PER_HOUR, listCareActions } = require('../shared/yoyo-actions');

const NEED_META = {
  satiety: {
    label: '饱腹',
    lowLine: '妈妈，Yoyo肚子有点空空的。',
    urgentLine: '妈妈，Yoyo真的饿啦，想吃一点东西。',
    stateName: 'waiting',
    recommendedAction: 'feed',
  },
  cleanliness: {
    label: '清洁',
    lowLine: '妈妈，Yoyo想洗香香。',
    urgentLine: '妈妈，Yoyo身上脏脏的，想洗澡。',
    stateName: 'bashful',
    recommendedAction: 'bath',
  },
  mood: {
    label: '心情',
    lowLine: '妈妈，Yoyo有点想你陪陪。',
    urgentLine: '妈妈，Yoyo今天有点低落，抱抱好不好？',
    stateName: 'crying',
    recommendedAction: 'pet',
  },
  energy: {
    label: '体力',
    lowLine: '妈妈，Yoyo有点困了。',
    urgentLine: '妈妈，Yoyo困到眼皮打架啦。',
    stateName: 'yawning',
    recommendedAction: 'sleep',
  },
};

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeToday(today = {}) {
  const currentDate = dateKey();
  if (today.date !== currentDate) {
    return { date: currentDate, feed: 0, bath: 0, sleep: 0, play: 0, pet: 0 };
  }
  return {
    date: currentDate,
    feed: Number(today.feed || 0),
    bath: Number(today.bath || 0),
    sleep: Number(today.sleep || 0),
    play: Number(today.play || 0),
    pet: Number(today.pet || 0),
  };
}

function getStatus(life) {
  const needs = [life.satiety, life.cleanliness, life.mood, life.energy];
  const minNeed = Math.min(...needs);
  if (minNeed < 22) return 'urgent';
  if (minNeed < 42) return 'needs-care';
  if (life.affection >= 78 && life.mood >= 72) return 'close';
  return 'steady';
}

function getSummary(life) {
  const lowest = getLowestNeed(life);
  const lowSummary = {
    satiety: '有点饿',
    cleanliness: '想洗香香',
    mood: '想被陪一下',
    energy: '有点累',
  };

  if (lowest.value < 35) return lowSummary[lowest.key];
  if (life.affection >= 80) return '很依赖你';
  if (life.mood >= 78) return '心情很好';
  return '安稳陪伴中';
}

function getLowestNeed(life) {
  return [
    { key: 'satiety', value: clamp(life.satiety), ...NEED_META.satiety },
    { key: 'cleanliness', value: clamp(life.cleanliness), ...NEED_META.cleanliness },
    { key: 'mood', value: clamp(life.mood), ...NEED_META.mood },
    { key: 'energy', value: clamp(life.energy), ...NEED_META.energy },
  ].sort((a, b) => a.value - b.value)[0];
}

function getNeedPrompt(life) {
  const lowest = getLowestNeed(life);
  if (lowest.value >= 42) return null;
  return {
    ...lowest,
    line: lowest.value < 22 ? lowest.urgentLine : lowest.lowLine,
    urgency: lowest.value < 22 ? 'urgent' : 'soft',
  };
}

function getProfile(petData) {
  const firstDay = Number(petData.firstDay || Date.now());
  return {
    level: Number(petData.growth?.level || 1),
    xp: Number(petData.growth?.xp || 0),
    intimacy: Number(petData.relationship?.intimacy || 0),
    trust: Number(petData.relationship?.trust || 0),
    stage: petData.relationship?.stage || 'first_meet',
    companionDays: Math.max(0, Math.floor((Date.now() - firstDay) / 86400000)),
  };
}

function actionAlreadyEnough(life, actionId) {
  const action = CARE_ACTIONS[actionId];
  if (!action?.needKey) return false;
  if (actionId === 'pet') return false;
  return clamp(life[action.needKey]) >= 94;
}

function getCareBlocker(life, actionId) {
  if (actionId === 'bath' && clamp(life.energy) < 18) {
    return {
      message: 'Yoyo困到站不稳了，先睡一下再洗吧。',
      stateName: 'yawning',
      recommendedAction: 'sleep',
    };
  }
  if (actionId === 'play' && clamp(life.energy) < 20) {
    return {
      message: 'Yoyo现在有点累，先休息一下再玩好不好？',
      stateName: 'yawning',
      recommendedAction: 'sleep',
    };
  }
  if (actionId === 'sleep' && clamp(life.energy) > 96) {
    return {
      message: 'Yoyo现在精神满满，暂时还不想睡。',
      stateName: 'jumping',
      recommendedAction: 'play',
    };
  }
  return null;
}

function buildCareResponse(actionId, before, life) {
  const action = CARE_ACTIONS[actionId];
  const blocker = getCareBlocker(before, actionId);
  if (blocker) {
    return {
      ...blocker,
      effective: false,
      blocked: true,
    };
  }
  const lowestBefore = getLowestNeed(before);
  const helpedLowest = action.needKey === lowestBefore.key && lowestBefore.value < 42;
  if (helpedLowest) {
    const strongMessages = {
      feed: '刚好饿了！这口饭把 Yoyo 救回来啦～',
      bath: '终于洗香香啦，Yoyo整个人都轻快了～',
      sleep: 'Yoyo睡醒一点点了，脑袋不晕啦。',
      play: '被妈妈陪着玩，Yoyo心情一下亮起来了～',
      pet: '妈妈摸摸以后，Yoyo安心多了。',
    };
    return {
      message: strongMessages[actionId] || action.desktopLine,
      stateName: action.stateName,
      effective: true,
    };
  }
  if (actionAlreadyEnough(before, actionId)) {
    const alreadyEnough = {
      feed: 'Yoyo已经很饱啦，这次就尝一小口。',
      bath: 'Yoyo已经香香的啦，再冲一下就好。',
      sleep: 'Yoyo现在还精神，先闭眼休息一下。',
      play: 'Yoyo刚玩过啦，再轻轻玩一下。',
    };
    return {
      message: alreadyEnough[actionId] || action.desktopLine,
      stateName: actionId === 'sleep' ? 'yawning' : 'bashful',
      effective: false,
    };
  }
  return {
    message: action.desktopLine,
    stateName: action.stateName,
    effective: true,
  };
}

function applyDecay(life, now = Date.now()) {
  const lastUpdatedAt = Number(life.lastUpdatedAt || 0);
  life.today = normalizeToday(life.today);
  if (!lastUpdatedAt || lastUpdatedAt > now) {
    life.lastUpdatedAt = now;
    life.status = getStatus(life);
    return life;
  }

  const elapsedHours = Math.min(24, Math.max(0, now - lastUpdatedAt) / 3600000);
  if (elapsedHours < 0.05) {
    life.status = getStatus(life);
    return life;
  }

  for (const [key, perHour] of Object.entries(DECAY_PER_HOUR)) {
    life[key] = clamp(life[key] + perHour * elapsedHours);
  }
  life.lastUpdatedAt = now;
  life.status = getStatus(life);
  return life;
}

function applyDelta(life, delta) {
  for (const [key, amount] of Object.entries(delta)) {
    life[key] = clamp(life[key] + amount);
  }
}

function scaleDelta(delta, factor) {
  return Object.fromEntries(Object.entries(delta).map(([key, value]) => [key, value * factor]));
}

function buildSnapshot(petData, extra = {}) {
  const life = petData.life;
  const prompt = getNeedPrompt(life);
  const lowestNeed = getLowestNeed(life);
  const recommendedAction = lowestNeed.value < 70 ? lowestNeed.recommendedAction : null;
  return {
    ...life,
    summary: getSummary(life),
    status: getStatus(life),
    lowestNeed,
    prompt,
    recommendedAction,
    profile: getProfile(petData),
    careActions: listCareActions(recommendedAction),
    ...extra,
  };
}

function broadcastLifeChanged(snapshot) {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send('life:changed', snapshot);
    }
  }
}

function registerLifeIpc({ ipcMain, getData, saveData, getMainWindow }) {
  ipcMain.handle('life:actions', () => listCareActions());

  ipcMain.handle('life:get', () => {
    const petData = getData();
    applyDecay(petData.life);
    saveData();
    return buildSnapshot(petData);
  });

  ipcMain.handle('life:care', (_event, actionId) => {
    const action = CARE_ACTIONS[actionId];
    if (!action) return { ok: false, error: '未知的照顾动作' };

    const petData = getData();
    const now = Date.now();
    applyDecay(petData.life, now);
    const before = { ...petData.life };
    const alreadyEnough = actionAlreadyEnough(before, actionId);
    const response = buildCareResponse(actionId, before, petData.life);
    if (!response.blocked) {
      applyDelta(petData.life, alreadyEnough ? scaleDelta(action.delta, 0.25) : action.delta);
      petData.life.today = normalizeToday(petData.life.today);
      petData.life.today[actionId] = Number(petData.life.today[actionId] || 0) + 1;
    }
    petData.life.lastCareAction = actionId;
    petData.life.lastCareAt = now;
    petData.life.lastUpdatedAt = now;
    petData.life.status = getStatus(petData.life);

    if (petData.relationship) {
      const intimacyGain = response.effective ? 0.6 : 0.15;
      petData.relationship.intimacy = clamp(Number(petData.relationship.intimacy || 0) + intimacyGain, 0, 9999);
      petData.relationship.lastInteractionDate = dateKey();
    }
    if (petData.growth) {
      petData.growth.xp = Number(petData.growth.xp || 0) + (response.effective ? 2 : 1);
    }

    saveData();
    const snapshot = buildSnapshot(petData, {
      ok: true,
      action: actionId,
      actionLabel: action.label,
      message: response.message,
      stateName: response.stateName,
      effective: response.effective,
      blocked: Boolean(response.blocked),
      redirectedAction: response.recommendedAction || null,
    });
    broadcastLifeChanged(snapshot);
    const mainWindow = getMainWindow();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('life:care-feedback', snapshot);
    }
    return snapshot;
  });
}

module.exports = {
  registerLifeIpc,
};
