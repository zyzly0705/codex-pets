#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const allowPending = args.includes('--allow-pending');
const batchArg = args.find((arg) => !arg.startsWith('--'));
const batchDir = batchArg
  ? path.resolve(batchArg)
  : path.join(repoRoot, 'output', 'yoyo-asset-runs', 'yoyo-redesign-v1');

function rel(filePath) {
  return path.relative(repoRoot, filePath);
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function filesIn(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(dir, entry.name));
}

function hasEvidence(assetDir, folders) {
  return folders.some((folder) => filesIn(path.join(assetDir, folder)).length > 0);
}

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function auditAsset(assetDir) {
  const manifestPath = path.join(assetDir, 'workflow-manifest.json');
  const requestPath = path.join(assetDir, 'asset-request.json');
  if (!fs.existsSync(manifestPath)) {
    return { status: 'invalid', name: path.basename(assetDir), errors: [`missing ${rel(manifestPath)}`] };
  }
  if (!fs.existsSync(requestPath)) {
    return { status: 'invalid', name: path.basename(assetDir), errors: [`missing ${rel(requestPath)}`] };
  }

  const manifest = readJson(manifestPath);
  const request = readJson(requestPath);
  const errors = [];
  const status = manifest.status || 'prepared';
  const motion = request.motion || {};

  if (!request.phase) errors.push(`asset ${request.name} is missing phase`);
  if (!request.kind) errors.push(`asset ${request.name} is missing kind`);
  if (!Number.isFinite(Number(motion.frames))) errors.push(`asset ${request.name} is missing motion.frames`);
  if (!Number.isFinite(Number(motion.fps))) errors.push(`asset ${request.name} is missing motion.fps`);
  if (!fs.existsSync(path.join(assetDir, 'prompts', 'visual-prompt.md'))) {
    errors.push(`asset ${request.name} is missing visual prompt`);
  }
  if (!fs.existsSync(path.join(assetDir, 'qa', 'review-checklist.md'))) {
    errors.push(`asset ${request.name} is missing review checklist`);
  }

  if (status === 'accepted') {
    if (!hasEvidence(assetDir, ['sources'])) {
      errors.push(`accepted asset ${request.name} is missing source evidence`);
    }
    if (!hasEvidence(assetDir, ['processed']) && request.kind !== 'style') {
      errors.push(`accepted asset ${request.name} is missing processed evidence`);
    }
    if (!hasEvidence(assetDir, ['qa'])) {
      errors.push(`accepted asset ${request.name} is missing QA evidence`);
    }
  }

  return { status, name: request.name, errors };
}

function main() {
  const manifestPath = path.join(batchDir, 'batch-manifest.json');
  if (!fs.existsSync(manifestPath)) {
    fail(`Yoyo redesign audit failed: missing ${rel(manifestPath)}`);
    process.exit();
  }

  const batch = readJson(manifestPath);
  const assetsDir = path.join(batchDir, 'assets');
  const assetDirs = fs.readdirSync(assetsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => path.join(assetsDir, entry.name))
    .sort();

  const results = assetDirs.map(auditAsset);
  const errors = results.flatMap((result) => result.errors);
  const accepted = results.filter((result) => result.status === 'accepted').length;
  const prepared = results.filter((result) => result.status === 'prepared').length;
  const pending = results.filter((result) => result.status !== 'accepted').length;

  console.log(`Yoyo redesign audit: ${batch.name}`);
  console.log(`assets: ${results.length}`);
  console.log(`accepted: ${accepted}`);
  console.log(`prepared: ${prepared}`);
  console.log(`pending: ${pending}`);

  for (const result of results) {
    console.log(`- ${result.name}: ${result.status}${result.errors.length ? ` (${result.errors.length} issue${result.errors.length === 1 ? '' : 's'})` : ''}`);
  }

  if (!allowPending && pending > 0) {
    errors.push(`redesign batch has ${pending} pending assets`);
  }

  if (errors.length > 0) {
    fail(`Yoyo redesign audit failed:\n${errors.map((error) => `- ${error}`).join('\n')}`);
  }
}

main();
