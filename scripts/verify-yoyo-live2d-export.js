#!/usr/bin/env node
const { existsSync } = require('node:fs');
const { dirname, join, resolve } = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = dirname(__dirname);
const defaultModel = join(repoRoot, 'assets/yoyo/live2d/yoyo/yoyo.model3.json');

function parseArgs(argv) {
  const args = { model: defaultModel };
  for (const arg of argv) {
    if (arg.startsWith('--model=')) args.model = resolve(repoRoot, arg.slice('--model='.length));
    else if (!arg.startsWith('--')) args.model = resolve(repoRoot, arg);
  }
  return args;
}

function printMissingExport(modelPath) {
  console.error('Yoyo Live2D export is missing.');
  console.error(`Expected model: ${modelPath}`);
  console.error('Export these files from Cubism into assets/yoyo/live2d/yoyo/:');
  console.error('- yoyo.model3.json');
  console.error('- yoyo.moc3');
  console.error('- textures/*');
  console.error('- motions/* with at least an Idle/idle group');
}

function main() {
  const { model } = parseArgs(process.argv.slice(2));
  if (!existsSync(model)) {
    printMissingExport(model);
    process.exit(1);
  }

  const result = spawnSync('cli-anything-live2d', ['--json', 'yoyo-check', model], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (result.error) {
    console.error(`Failed to run cli-anything-live2d: ${result.error.message}`);
    console.error('Run: pipx install --force /Users/zhangyazhou/Downloads/work/live2d-cli/agent-harness');
    process.exit(1);
  }

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exit(result.status ?? 1);
}

main();
