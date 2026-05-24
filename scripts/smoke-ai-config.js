const fs = require('fs');

const main = fs.readFileSync('src/main.js', 'utf8');
const mainAi = fs.readFileSync('src/main/ai-lines.js', 'utf8');
const mainWindows = fs.readFileSync('src/main/app-windows.js', 'utf8');
const mainStore = fs.readFileSync('src/main/store.js', 'utf8');
const preload = fs.readFileSync('src/preload.js', 'utf8');
const aiDialogue = fs.readFileSync('src/modules/ai-dialogue.js', 'utf8');
const settings = fs.readFileSync('src/settings.html', 'utf8');
const relationship = fs.readFileSync('src/modules/relationship-system.js', 'utf8');
const planner = fs.readFileSync('src/modules/companion-planner.js', 'utf8');
const dailyMemory = fs.readFileSync('src/modules/daily-memory.js', 'utf8');
const dialogueGuard = fs.readFileSync('src/modules/dialogue-guard.js', 'utf8');

const checks = [
  ['main reads YOYO_DEEPSEEK_API_KEY', /YOYO_DEEPSEEK_API_KEY/.test(main + mainAi)],
  ['main loads dot env', /loadDotEnv/.test(main)],
  ['main exposes ai:yoyo-line', /ai:yoyo-line/.test(main + mainAi)],
  ['main exposes preference reset', /preferences:reset-behavior/.test(main + mainWindows)],
  ['preload exposes generateYoyoLine', /generateYoyoLine/.test(preload)],
  ['renderer has ai dialogue enhancer', /maybeEnhanceLine/.test(aiDialogue)],
  ['settings has AI toggle', /aiLinesEnabled/.test(settings)],
  ['relationship system exists', /RELATIONSHIP_STAGES/.test(relationship)],
  ['companion planner exists', /plannerAllowsBehavior/.test(planner)],
  ['daily memory exists', /maybeSpeakDailySummary/.test(dailyMemory)],
  ['settings shows relationship', /relStage/.test(settings)],
  ['dialogue guard exists', /guardYoyoLine/.test(dialogueGuard)],
  ['daily cards exist', /dailyCards/.test(main + mainStore) && /memoryCards/.test(settings)],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  for (const [name] of failed) console.error(`Missing: ${name}`);
  process.exit(1);
}

console.log('AI config smoke OK');
