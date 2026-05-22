const { app } = require('electron');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(app.getPath('userData'), 'yoyo-data.json');
const settingsPath = path.join(app.getPath('userData'), 'yoyo-settings.json');

const DEFAULT_LIFE = {
  satiety: 72,
  cleanliness: 70,
  mood: 68,
  energy: 74,
  affection: 18,
  status: 'steady',
  lastUpdatedAt: 0,
  lastCareAction: null,
  lastCareAt: 0,
  today: { date: '', feed: 0, bath: 0, sleep: 0, play: 0, pet: 0 },
};

const DEFAULT_DATA = {
  settings: {
    autoStart: true, soundEnabled: true, reminderFreq: 'medium',
    activity: 'normal', workStartHour: 9, workEndHour: 18,
    aiLinesEnabled: true,
    workMode: 'balanced',
  },
  growth: {
    xp: 0, level: 1, path: null, lastLoginDate: '',
    pathStats: { interactionCount: 0, companionTime: 0, workTime: 0 },
  },
  memory: {
    startTimes: [], endTimes: [], lastPetTime: null, lastFedTime: null,
    lastWhipTime: null, totalPetCount: 0, totalFedCount: 0, totalWhipCount: 0,
    hourlyActivity: Array(24).fill(0), totalActiveDays: 0,
    consecutiveDays: 0, lastActiveDate: null,
    preference: {
      behaviorWeights: {}, quietHours: [], interactionTolerance: 'normal',
      lastFeedbackAt: null, recentFeedback: [], lastDecayDate: null,
    },
  },
  relationship: {
    intimacy: 0, trust: 60, longing: 0, stage: 'first_meet',
    firstMetDate: null, lastStageChangeDate: null, lastInteractionDate: null,
    nicknames: ['妈妈'], milestones: [],
  },
  companionPlan: null,
  dailyMemory: null,
  dailyCards: [],
  checkin: { streak: 0, lastDate: '', totalDays: 0 },
  achievements: {
    unlocked: [],
    stats: {
      petCount: 0, overtimeCount: 0, cloneTriggered: false,
      weatherRemindCount: 0, featuresUsed: 0, totalHours: 0,
      danceCount: 0, climbCount: 0,
    },
  },
  dailyFlags: {},
  firstDay: null,
  lastGreetDate: null,
  muted: false,
  shownTips: [],
  outfit: { look: 'default' },
  news: { lastFetchAt: 0, items: [] },
  life: DEFAULT_LIFE,
  home: {
    selectedScene: '',
    decor: {
      fairyLights: true,
      floorStars: false,
      softGlow: true,
      keepsakes: false,
    },
    visitCount: 0,
    lastVisitAt: 0,
  },
  usedFeatures: [],
  hasSeenGuide: false,
  _migrated: false,
};

let petData = { ...DEFAULT_DATA };

function mergeDeep(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source || {})) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] !== null &&
      typeof target[key] === 'object'
    ) {
      result[key] = mergeDeep(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function normalizeLoadedData() {
  if (!Array.isArray(petData.memory.hourlyActivity) || petData.memory.hourlyActivity.length !== 24) {
    petData.memory.hourlyActivity = Array(24).fill(0);
  }
  petData.outfit = { ...DEFAULT_DATA.outfit, ...(petData.outfit || {}) };
  petData.home = mergeDeep(DEFAULT_DATA.home, petData.home || {});
  petData.life = mergeDeep(DEFAULT_LIFE, petData.life || {});
  if (!petData.life.today || typeof petData.life.today !== 'object') {
    petData.life.today = { ...DEFAULT_LIFE.today };
  } else {
    petData.life.today = { ...DEFAULT_LIFE.today, ...petData.life.today };
  }
}

function loadData() {
  try {
    const raw = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    petData = mergeDeep(DEFAULT_DATA, raw);
    normalizeLoadedData();
  } catch {
    petData = { ...DEFAULT_DATA };
    try {
      const oldSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
      petData.settings = { ...petData.settings, ...oldSettings };
    } catch {
      // 首次启动或没有旧配置时使用默认值。
    }
    normalizeLoadedData();
  }
}

function saveData() {
  try {
    fs.writeFileSync(dataPath, JSON.stringify(petData, null, 2));
  } catch (e) {
    console.error('[Store] 保存失败:', e.message);
  }
}

function getData() {
  return petData;
}

function setData(nextData) {
  petData = nextData;
  normalizeLoadedData();
}

function registerStoreIpc({ ipcMain }) {
  ipcMain.handle('store:load', () => petData);
  ipcMain.handle('store:set', (_, key, value) => {
    petData[key] = value;
    saveData();
  });
  ipcMain.handle('store:batch', (_, updates) => {
    Object.assign(petData, updates);
    normalizeLoadedData();
    saveData();
  });
}

module.exports = {
  DEFAULT_DATA,
  DEFAULT_LIFE,
  dataPath,
  settingsPath,
  getData,
  loadData,
  saveData,
  setData,
  registerStoreIpc,
};
