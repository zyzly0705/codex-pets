#!/usr/bin/env node
const { existsSync, mkdirSync, writeFileSync } = require('node:fs');
const { dirname, join } = require('node:path');
const { spawnSync } = require('node:child_process');

const repoRoot = dirname(__dirname);
const outDir = join(repoRoot, 'output/yoyo-runtime-alternatives');

function hasCommand(command) {
  const result = spawnSync('zsh', ['-lc', `command -v ${command}`], { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

function hasNodePackage(name) {
  try {
    require.resolve(name, { paths: [repoRoot] });
    return true;
  } catch {
    return false;
  }
}

function appExists(paths) {
  return paths.find((path) => existsSync(path)) || '';
}

function writeRiveProbeHtml() {
  const html = `<!doctype html>
<meta charset="utf-8">
<title>Yoyo Rive Runtime Probe</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #eef3f1; font-family: system-ui, sans-serif; }
  main { width: min(720px, calc(100vw - 32px)); }
  canvas { width: 100%; aspect-ratio: 1 / 1; display: block; background: #fff; border: 1px solid #cdd8d2; }
  p { color: #31423b; line-height: 1.5; }
</style>
<main>
  <canvas id="rive" width="720" height="720"></canvas>
  <p>Drop a <code>.riv</code> file beside this HTML and set <code>src</code> in the script. This probe is for checking whether Rive runtime can host a Yoyo desktop-pet action.</p>
</main>
<script type="module">
  const canvas = document.getElementById('rive');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f8fbf9';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#25352f';
  ctx.font = '24px system-ui, sans-serif';
  ctx.fillText('Rive runtime slot', 32, 64);
  ctx.font = '16px system-ui, sans-serif';
  ctx.fillText('Needs @rive-app/canvas and a real .riv asset export.', 32, 100);
</script>
`;
  writeFileSync(join(outDir, 'rive-probe.html'), html, 'utf8');
}

function main() {
  mkdirSync(outDir, { recursive: true });

  const riveCanvasInstalled = hasNodePackage('@rive-app/canvas');
  const riveProbe = {
    id: 'rive',
    status: riveCanvasInstalled ? 'runtime-installed' : 'runtime-missing',
    nodePackage: '@rive-app/canvas',
    canRunInElectron: true,
    assetNeeded: '.riv exported from Rive Editor',
    fitForYoyo: 'good-for-state-machine-actions',
    blockers: riveCanvasInstalled
      ? ['No Yoyo .riv asset has been authored yet']
      : ['@rive-app/canvas is not installed', 'No Yoyo .riv asset has been authored yet'],
  };

  const inochiCreator = appExists([
    '/Applications/Inochi Creator.app',
    '/Applications/Inochi2D/Inochi Creator.app',
  ]);
  const inochiSession = appExists([
    '/Applications/Inochi Session.app',
    '/Applications/Inochi2D/Inochi Session.app',
  ]);
  const inochiCommand = hasCommand('inochi-creator') || hasCommand('inochi-session');
  const inochiProbe = {
    id: 'inochi2d',
    status: inochiCreator || inochiSession || inochiCommand ? 'tooling-found' : 'tooling-missing',
    app: inochiCreator || inochiSession || '',
    command: inochiCommand,
    canRunInElectron: false,
    assetNeeded: '.inp puppet authored in Inochi Creator',
    fitForYoyo: 'possible-puppet-route-but-not-fastest-electron-route',
    blockers: [
      'No official drop-in Web/Electron runtime is present in this project',
      'No Yoyo .inp puppet has been authored yet',
    ],
  };

  const report = {
    generatedAt: new Date().toISOString(),
    recommendation: riveCanvasInstalled
      ? 'Try Rive only after authoring a small Yoyo .riv action; keep spritesheet runtime as the main path.'
      : 'Do not switch the main Yoyo path yet. Keep spritesheet runtime, install Rive runtime when registry is stable, and treat Inochi2D as a later editor/SDK evaluation.',
    probes: [riveProbe, inochiProbe],
    nextCommands: [
      'npm install @rive-app/canvas --save-dev',
      'npm run probe:runtime-alternatives',
      'open output/yoyo-runtime-alternatives/rive-probe.html',
    ],
  };

  writeRiveProbeHtml();
  writeFileSync(join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  writeFileSync(
    join(outDir, 'report.md'),
    [
      '# Yoyo Runtime Alternatives Probe',
      '',
      `Generated: ${report.generatedAt}`,
      '',
      `Recommendation: ${report.recommendation}`,
      '',
      '## Rive',
      '',
      `- Status: ${riveProbe.status}`,
      `- Runtime package: ${riveProbe.nodePackage}`,
      `- Fit: ${riveProbe.fitForYoyo}`,
      `- Blockers: ${riveProbe.blockers.join('; ')}`,
      '',
      '## Inochi2D',
      '',
      `- Status: ${inochiProbe.status}`,
      `- App: ${inochiProbe.app || 'not found'}`,
      `- Command: ${inochiProbe.command || 'not found'}`,
      `- Fit: ${inochiProbe.fitForYoyo}`,
      `- Blockers: ${inochiProbe.blockers.join('; ')}`,
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(JSON.stringify(report, null, 2));
}

main();
