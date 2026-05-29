const fs = require('fs');
const path = require('path');

function resolvePackFile(dir, filePath) {
  if (!filePath) return '';
  return path.isAbsolute(filePath) ? filePath : path.resolve(dir, filePath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readInventorySummary(dir) {
  const inventoryPath = path.join(dir, 'qa', 'asset-inventory.json');
  if (!fs.existsSync(inventoryPath)) {
    return {
      total: 0,
      uncovered: null,
      statusCounts: {},
    };
  }

  const inventory = readJson(inventoryPath);
  const statusCounts = {};
  for (const asset of inventory.assets || []) {
    statusCounts[asset.status] = (statusCounts[asset.status] || 0) + 1;
  }

  return {
    total: Array.isArray(inventory.assets) ? inventory.assets.length : 0,
    uncovered: Array.isArray(inventory.uncovered) ? inventory.uncovered.length : null,
    statusCounts,
  };
}

function readRedrawQueueSummary(dir) {
  const queuePath = path.join(dir, 'qa', 'redraw-queue.json');
  if (!fs.existsSync(queuePath)) {
    return {
      total: 0,
      highPriority: 0,
      next: null,
    };
  }

  const queue = readJson(queuePath);
  const items = Array.isArray(queue.items) ? queue.items : [];
  const next = items.find((item) => item.status === 'queued') || items[0] || null;

  return {
    total: Number.isFinite(queue.total) ? queue.total : items.length,
    highPriority: items.filter((item) => item.priority === 'high').length,
    next: next ? {
      path: next.path,
      priority: next.priority,
      kind: next.kind,
      briefPath: next.briefPath,
    } : null,
  };
}

function readCandidateRegistrySummary(dir) {
  const registryPath = path.join(dir, 'qa', 'candidate-registry.json');
  if (!fs.existsSync(registryPath)) {
    return {
      totalTargets: 0,
      totalCandidates: 0,
      dispositionCounts: {},
    };
  }

  const registry = readJson(registryPath);
  return {
    totalTargets: Number.isFinite(registry.totalTargets) ? registry.totalTargets : 0,
    totalCandidates: Number.isFinite(registry.totalCandidates) ? registry.totalCandidates : 0,
    dispositionCounts: registry.dispositionCounts || {},
  };
}

function readAssetPack(dir) {
  const manifestPath = path.join(dir, 'pack-manifest.json');
  if (!fs.existsSync(manifestPath)) return null;

  const manifest = readJson(manifestPath);

  return {
    id: manifest.id || path.basename(dir),
    displayName: manifest.displayName || manifest.id || path.basename(dir),
    type: manifest.type || 'companion',
    style: manifest.style || '',
    manifestPath,
    semantics: manifest.semantics || {},
    avatar: {
      driver: manifest.avatar?.driver || '',
      sheet: manifest.avatar?.sheet || '',
      actions: manifest.avatar?.actions || '',
      goldenActions: Array.isArray(manifest.avatar?.goldenActions) ? manifest.avatar.goldenActions : [],
    },
    home: manifest.home || {},
    careScenes: manifest.careScenes || {},
    specialActions: manifest.specialActions || {},
    qa: {
      ...(manifest.qa || {}),
      reportPath: resolvePackFile(dir, manifest.qa?.report),
      redrawQueuePath: resolvePackFile(dir, manifest.qa?.redrawQueue),
      candidateRegistryPath: resolvePackFile(dir, manifest.qa?.candidateRegistry),
    },
    inventorySummary: readInventorySummary(dir),
    redrawQueueSummary: readRedrawQueueSummary(dir),
    candidateRegistrySummary: readCandidateRegistrySummary(dir),
  };
}

module.exports = {
  readAssetPack,
  resolvePackFile,
};
