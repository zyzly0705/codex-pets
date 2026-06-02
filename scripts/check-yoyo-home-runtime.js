#!/usr/bin/env node
const { execFileSync } = require('child_process');
const { readdirSync, statSync } = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const runtimeRoot = path.join(repoRoot, 'src/yoyo-home');

function walk(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const filePath = path.join(dir, name);
    const stats = statSync(filePath);
    if (stats.isDirectory()) {
      files.push(...walk(filePath));
    } else if (/\.(?:mjs|js)$/u.test(name)) {
      files.push(filePath);
    }
  }
  return files;
}

for (const filePath of walk(runtimeRoot)) {
  execFileSync(process.execPath, ['--check', filePath], { stdio: 'inherit' });
}

console.log(`Yoyo home runtime syntax OK: ${path.relative(repoRoot, runtimeRoot)}`);
