const { readFileSync } = require('fs');
const { join } = require('path');

const root = join(__dirname, '..');
const engine = readFileSync(join(root, 'src/modules/behavior-engine.js'), 'utf8');
const core = readFileSync(join(root, 'src/modules/core-state.js'), 'utf8');
const data = readFileSync(join(root, 'src/modules/behavior-data.js'), 'utf8');

function extractObjectKeys(source, marker) {
  const start = source.indexOf(marker);
  if (start === -1) return [];
  const open = source.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}') {
      depth--;
      if (depth === 0) {
        const body = source.slice(open + 1, i);
        return [...body.matchAll(/^\s*([A-Za-z0-9_]+)\s*:/gm)].map(match => match[1]);
      }
    }
  }
  return [];
}

const behaviorNames = [...engine.matchAll(/^\s*name:\s*'([^']+)'/gm)].map(match => match[1]);
const behaviorStates = [...engine.matchAll(/^\s*state:\s*'([^']+)'/gm)].map(match => match[1]);
const animationStates = new Set(extractObjectKeys(core, 'export const STATES'));
const metaNames = new Set(extractObjectKeys(data, 'export const BEHAVIOR_META'));
const needEffectNames = new Set(extractObjectKeys(data, 'export const NEED_EFFECTS'));
const dialogueNames = new Set(extractObjectKeys(data, 'export const BEHAVIOR_DIALOGUES'));
const catalogNames = new Set(extractObjectKeys(data, 'export const BEHAVIOR_DIALOGUE_CATALOG'));
const learningKeys = new Set(extractObjectKeys(data, 'export const LEARNING_CONFIG'));
const feedbackTypes = new Set(extractObjectKeys(data, 'feedbackImpact'));

const errors = [];

for (const name of behaviorNames) {
  if (!metaNames.has(name)) errors.push(`Missing BEHAVIOR_META entry for ${name}`);
}

for (const state of behaviorStates) {
  if (!animationStates.has(state)) errors.push(`Behavior references unknown animation state ${state}`);
}

for (const name of needEffectNames) {
  if (!behaviorNames.includes(name)) errors.push(`NEED_EFFECTS has no matching behavior ${name}`);
}

for (const name of dialogueNames) {
  if (!behaviorNames.includes(name)) errors.push(`BEHAVIOR_DIALOGUES has no matching behavior ${name}`);
}

for (const name of ['swing', 'digSand', 'readBook', 'watchTV', 'fanCooling', 'swimming', 'airConditioning', 'sofaLying', 'wpsCompanion']) {
  if (!catalogNames.has(name)) errors.push(`Missing dialogue catalog entry ${name}`);
}

for (const key of ['feedbackWindowMs', 'historyLimit', 'weightMin', 'weightMax', 'decayPerDay', 'scoreScale', 'feedbackImpact']) {
  if (!learningKeys.has(key)) errors.push(`Missing LEARNING_CONFIG.${key}`);
}

for (const type of ['pet', 'feed', 'manual', 'drag', 'whip', 'interrupt']) {
  if (!feedbackTypes.has(type)) errors.push(`Missing learning feedback type ${type}`);
}

if (errors.length > 0) {
  console.error(errors.join('\n'));
  process.exit(1);
}

console.log(`Behavior data OK: ${behaviorNames.length} behaviors, ${animationStates.size} animation states`);
