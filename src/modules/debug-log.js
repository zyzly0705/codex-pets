let lastOutfitSignature = '';

function canLog() {
  return Boolean(window.petApi?.debugLog);
}

function normalizePayload(payload) {
  try {
    return JSON.parse(JSON.stringify(payload));
  } catch {
    return { error: 'serialize_failed' };
  }
}

export function debugLog(type, payload) {
  if (!canLog()) return;
  window.petApi.debugLog(type, normalizePayload(payload));
}

export function logBehaviorDecision(snapshot) {
  if (!snapshot) return;
  debugLog('behavior_tick', snapshot);
}

export function logBehaviorCommitted(payload) {
  debugLog('behavior_committed', payload);
}

export function logEmotionEvent(eventType, emotion) {
  debugLog('emotion_event', {
    eventType,
    emotion,
  });
}

export function logEmotionDecay(emotion) {
  debugLog('emotion_decay', { emotion });
}

export function logOutfitLayers(outfit, layers) {
  const signature = JSON.stringify({
    outfit,
    layers: layers.map(layer => ({
      category: layer.category,
      itemId: layer.itemId,
      position: layer.position,
      file: layer.file,
    })),
  });
  if (signature === lastOutfitSignature) return;
  lastOutfitSignature = signature;
  debugLog('outfit_layers', { outfit, layers });
}
