const HOME_TO_LIFE_ACTION = {
  feed: 'feed',
  sleep: 'sleep',
  bath: 'bath',
  play: 'play',
  comfort: 'pet',
  study: 'study',
  watchAnime: 'watchAnime',
  playSwitch: 'playSwitch',
  buildBlocks: 'buildBlocks',
};

function readLifeApi(petApi) {
  return petApi?.life || petApi || null;
}

function callLifeGet(petApi) {
  const lifeApi = readLifeApi(petApi);
  if (typeof lifeApi?.get === 'function') return lifeApi.get();
  if (typeof lifeApi?.getLife === 'function') return lifeApi.getLife();
  return Promise.resolve(null);
}

function callLifeCare(petApi, payload) {
  const lifeApi = readLifeApi(petApi);
  if (typeof lifeApi?.care === 'function') return lifeApi.care(payload);
  if (typeof lifeApi?.careForYoyo === 'function') return lifeApi.careForYoyo(payload);
  return Promise.resolve(null);
}

function onLifeChanged(petApi, callback) {
  const lifeApi = readLifeApi(petApi);
  if (typeof lifeApi?.onChanged === 'function') return lifeApi.onChanged(callback);
  if (typeof lifeApi?.onLifeChanged === 'function') return lifeApi.onLifeChanged(callback);
  return null;
}

function roundNeed(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, Math.round(number * 100) / 100));
}

export function mapLifeSnapshotToHomeNeeds(snapshot = {}, fallbackNeeds = {}) {
  return {
    hunger: roundNeed(snapshot.satiety, fallbackNeeds.hunger ?? 70),
    energy: roundNeed(snapshot.energy, fallbackNeeds.energy ?? 70),
    hygiene: roundNeed(snapshot.cleanliness, fallbackNeeds.hygiene ?? 70),
    fun: roundNeed(snapshot.fun, fallbackNeeds.fun ?? fallbackNeeds.mood ?? snapshot.mood ?? 60),
    focus: roundNeed(snapshot.focus, fallbackNeeds.focus ?? 55),
    affection: roundNeed(snapshot.affection, fallbackNeeds.affection ?? 65),
    mood: roundNeed(snapshot.mood, fallbackNeeds.mood ?? 62),
  };
}

export function mapHomeActionToLifeAction(actionId) {
  return HOME_TO_LIFE_ACTION[actionId] || actionId;
}

export async function loadInitialLifeBridgeOptions(petApi, fallbackState) {
  if (!petApi) return {};
  try {
    const snapshot = await callLifeGet(petApi);
    if (!snapshot) return {};
    return {
      needs: mapLifeSnapshotToHomeNeeds(snapshot, fallbackState?.needs),
      intimacy: snapshot.profile?.intimacy,
      xp: snapshot.profile?.xp,
      stage: snapshot.profile?.stage,
      companionDays: snapshot.profile?.companionDays,
      lifeSnapshot: snapshot,
    };
  } catch (error) {
    console.warn('[yoyo-home] life hydrate failed', error);
    return {};
  }
}

export function createElectronLifeBridge({ petApi, game, debug = false } = {}) {
  const sentCareKeys = new Set();
  const bridge = {
    connected: Boolean(petApi),
    latestLife: null,
    sentCareKeys,
  };
  if (!petApi) return bridge;

  function getRoomScene() {
    try {
      return game?.scene?.getScene?.('YoyoHomeRoom')
        || game?.scene?.keys?.YoyoHomeRoom
        || null;
    } catch {
      return null;
    }
  }

  function syncLifeSnapshot(snapshot) {
    bridge.latestLife = snapshot;
    const scene = getRoomScene();
    if (scene && typeof scene.applyExternalNeeds === 'function') {
      scene.applyExternalNeeds(mapLifeSnapshotToHomeNeeds(snapshot, scene.state?.needs), {
        source: 'life:changed',
        snapshot,
      });
    }
    window.YOYO_HOME_LIFE_BRIDGE = bridge;
  }

  onLifeChanged(petApi, syncLifeSnapshot);

  bridge.onStateChange = (state) => {
    const aftermath = state?.aftermath;
    if (!aftermath?.actionId) return;
    const key = `${aftermath.actionId}:${aftermath.objectId}:${aftermath.at}:${aftermath.result?.gameId || 'interaction'}`;
    if (sentCareKeys.has(key)) return;
    sentCareKeys.add(key);
    const payload = {
      actionId: mapHomeActionToLifeAction(aftermath.actionId),
      source: 'home',
      homeTask: aftermath,
    };
    if (debug && typeof petApi.debugLog === 'function') {
      petApi.debugLog('yoyo-home', {
        event: 'care_bridge_request',
        actionId: payload.actionId,
        objectId: aftermath.objectId,
      });
    }
    callLifeCare(petApi, payload)
      .then((snapshot) => {
        if (snapshot) syncLifeSnapshot(snapshot);
      })
      .catch((error) => {
        console.warn('[yoyo-home] care bridge failed', error);
      });
  };

  window.YOYO_HOME_LIFE_BRIDGE = bridge;
  return bridge;
}
