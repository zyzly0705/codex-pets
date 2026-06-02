#!/usr/bin/env node
const { readFileSync } = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const activeHomeHtml = path.join(repoRoot, 'src', 'yoyo-home.html');
const appWindows = path.join(repoRoot, 'src', 'main', 'app-windows.js');

const html = readFileSync(activeHomeHtml, 'utf8');
const windowsSource = readFileSync(appWindows, 'utf8');

const errors = [];
const forbiddenActiveRefs = [
  'home.css',
  'home.js',
  'home-games.js',
  'home-phaser-games.js',
  'home-spine-action.js',
  'home-spine-feed-assets.js',
  'shared/home-scene.js',
];

if (!/return 'yoyo-home\.html'/u.test(windowsSource)) {
  errors.push('openHome must load yoyo-home.html as the only active Home entry');
}

for (const forbidden of [
  'YOYO_HOME_REBUILD',
  'YOYO_HOME_LEGACY',
  "'home.html'",
  '"home.html"',
]) {
  if (windowsSource.includes(forbidden)) {
    errors.push(`active Home window source still references ${forbidden}`);
  }
}

for (const forbidden of forbiddenActiveRefs) {
  if (html.includes(forbidden)) {
    errors.push(`active yoyo-home.html must not load legacy Home asset: ${forbidden}`);
  }
}

if (!html.includes('./yoyo-home/index.js')) {
  errors.push('active yoyo-home.html must load the new yoyo-home/index.js entry');
}

if (!html.includes('./yoyo-home/styles.css')) {
  errors.push('active yoyo-home.html must load the new yoyo-home/styles.css stylesheet');
}

if (errors.length) {
  for (const error of errors) console.error(`Yoyo Home entry check failed: ${error}`);
  process.exit(1);
}

console.log('Yoyo Home entry OK: openHome -> src/yoyo-home.html with no legacy Home runtime refs');
