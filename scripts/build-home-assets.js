const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'yoyo', 'home');
const SRC_DIR = path.join(ROOT, 'assets-src', 'yoyo', 'home');
const PET_SHEET = path.join(ROOT, 'assets', 'yoyo', 'spritesheet.webp');
const ROOM_SCENES = [
  { name: 'default', source: 'yoyo-room-refined.png', output: 'room-stage-v2' },
  { name: 'night', source: 'yoyo-room-night.png', output: 'room-stage-night' },
  { name: 'rainy', source: 'yoyo-room-rainy.png', output: 'room-stage-rainy' },
  { name: 'party', source: 'yoyo-room-party.png', output: 'room-stage-party' },
];
const ASEPRITE_BIN = path.join(
  process.env.HOME,
  'deps',
  'aseprite-build',
  'build',
  'bin',
  'aseprite.app',
  'Contents',
  'MacOS',
  'aseprite'
);

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function pxSvg(width, height, body) {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" shape-rendering="crispEdges">
  <rect width="${width}" height="${height}" fill="none"/>
  ${body}
</svg>`);
}

function roomSvg() {
  return pxSvg(540, 360, `
    <rect width="540" height="360" fill="#83bfb5"/>
    <rect x="0" y="0" width="540" height="204" fill="#b4dfd7"/>
    <rect x="0" y="0" width="540" height="14" fill="#c8ebe4"/>
    <g opacity=".42">
      <rect x="0" y="34" width="540" height="3" fill="#d3eee7"/>
      <rect x="0" y="76" width="540" height="3" fill="#96c8be"/>
      <rect x="0" y="118" width="540" height="3" fill="#d3eee7"/>
      <rect x="0" y="160" width="540" height="3" fill="#96c8be"/>
      <rect x="0" y="196" width="540" height="3" fill="#d3eee7"/>
    </g>
    <g opacity=".18">
      <rect x="28" y="29" width="8" height="8" fill="#f6fff2"/>
      <rect x="170" y="65" width="7" height="7" fill="#f6fff2"/>
      <rect x="430" y="42" width="9" height="9" fill="#f6fff2"/>
      <rect x="477" y="171" width="7" height="7" fill="#f6fff2"/>
    </g>

    <rect x="0" y="204" width="540" height="156" fill="#b87452"/>
    <rect x="0" y="198" width="540" height="9" fill="#557160"/>
    <rect x="0" y="207" width="540" height="6" fill="#3d5247"/>
    <g opacity=".47">
      <rect x="0" y="240" width="540" height="4" fill="#7b4e39"/>
      <rect x="0" y="276" width="540" height="4" fill="#7b4e39"/>
      <rect x="0" y="312" width="540" height="4" fill="#7b4e39"/>
      <rect x="0" y="348" width="540" height="4" fill="#7b4e39"/>
      <rect x="60" y="204" width="4" height="156" fill="#7b4e39"/>
      <rect x="128" y="204" width="4" height="156" fill="#7b4e39"/>
      <rect x="196" y="204" width="4" height="156" fill="#7b4e39"/>
      <rect x="264" y="204" width="4" height="156" fill="#7b4e39"/>
      <rect x="332" y="204" width="4" height="156" fill="#7b4e39"/>
      <rect x="400" y="204" width="4" height="156" fill="#7b4e39"/>
      <rect x="468" y="204" width="4" height="156" fill="#7b4e39"/>
    </g>
    <g opacity=".2">
      <rect x="12" y="218" width="42" height="6" fill="#e39d70"/>
      <rect x="83" y="252" width="54" height="6" fill="#e39d70"/>
      <rect x="232" y="294" width="48" height="6" fill="#e39d70"/>
      <rect x="415" y="326" width="45" height="6" fill="#e39d70"/>
      <rect x="492" y="228" width="34" height="6" fill="#e39d70"/>
    </g>

    <rect x="36" y="40" width="177" height="124" fill="#43554a"/>
    <rect x="42" y="34" width="177" height="124" fill="#fff0c9"/>
    <rect x="52" y="44" width="157" height="104" fill="#669fb6"/>
    <rect x="106" y="44" width="7" height="104" fill="#fff0c9"/>
    <rect x="52" y="91" width="157" height="7" fill="#fff0c9"/>
    <rect x="50" y="30" width="36" height="132" fill="#ef8a89"/>
    <rect x="178" y="30" width="36" height="132" fill="#ef8a89"/>
    <rect x="54" y="34" width="27" height="120" fill="#f5aaa2"/>
    <rect x="183" y="34" width="27" height="120" fill="#f5aaa2"/>
    <rect x="54" y="124" width="155" height="24" fill="#569966"/>
    <rect x="55" y="117" width="38" height="10" fill="#78bd72"/>
    <rect x="100" y="113" width="51" height="13" fill="#78bd72"/>
    <rect x="151" y="119" width="58" height="8" fill="#78bd72"/>
    <rect x="36" y="164" width="190" height="8" fill="#799b87"/>
    <rect x="42" y="172" width="176" height="4" fill="#587867" opacity=".55"/>

    <rect x="306" y="91" width="176" height="10" fill="#3d5247"/>
    <rect x="315" y="78" width="33" height="18" fill="#dbe8c6"/>
    <rect x="319" y="63" width="25" height="18" fill="#f6f0d5"/>
    <rect x="371" y="49" width="38" height="42" fill="#e2b865"/>
    <rect x="377" y="56" width="26" height="7" fill="#f2d17c"/>
    <rect x="421" y="70" width="42" height="21" fill="#9dc9cd"/>
    <rect x="462" y="58" width="17" height="33" fill="#f6ecd0"/>
    <rect x="462" y="58" width="5" height="33" fill="#c9b48e"/>
    <rect x="314" y="101" width="156" height="3" fill="#263a34" opacity=".42"/>

    <rect x="423" y="30" width="58" height="46" fill="#a8495b"/>
    <rect x="429" y="36" width="46" height="34" fill="#ffe0a5"/>
    <rect x="440" y="44" width="24" height="5" fill="#795743"/>
    <rect x="440" y="56" width="24" height="5" fill="#795743"/>
    <rect x="481" y="61" width="11" height="10" fill="#a8495b"/>
    <rect x="430" y="76" width="48" height="4" fill="#8c3b4b"/>

    <rect x="64" y="170" width="16" height="26" fill="#5a8a47"/>
    <rect x="56" y="160" width="31" height="16" fill="#65ac70"/>
    <rect x="53" y="194" width="39" height="12" fill="#a95f4c"/>
    <rect x="57" y="191" width="31" height="5" fill="#d17d59"/>
    <rect x="66" y="153" width="10" height="8" fill="#85c87b"/>

    <rect x="225" y="262" width="92" height="6" fill="#754a42" opacity=".26"/>
    <rect x="242" y="239" width="58" height="9" fill="#bc7480"/>
    <rect x="222" y="248" width="98" height="13" fill="#d1999d"/>
    <rect x="207" y="261" width="128" height="14" fill="#c7858b"/>
    <rect x="221" y="275" width="99" height="8" fill="#91575a"/>
    <rect x="245" y="249" width="52" height="4" fill="#e6b4a8" opacity=".68"/>
    <rect x="232" y="265" width="76" height="3" fill="#e4a9a5" opacity=".42"/>

    <rect x="68" y="226" width="42" height="8" fill="#744a3a" opacity=".34"/>
    <rect x="66" y="216" width="40" height="17" fill="#bd4f5e"/>
    <rect x="70" y="211" width="32" height="9" fill="#f4dca3"/>
    <rect x="72" y="212" width="6" height="6" fill="#87583b"/>
    <rect x="84" y="212" width="6" height="6" fill="#b9763b"/>
    <rect x="96" y="212" width="6" height="6" fill="#87583b"/>
    <rect x="75" y="224" width="25" height="4" fill="#f08b7a"/>

    <rect x="416" y="233" width="62" height="10" fill="#4b6570" opacity=".34"/>
    <rect x="416" y="220" width="62" height="23" fill="#61aeca"/>
    <rect x="421" y="213" width="52" height="12" fill="#a7e4ec"/>
    <rect x="422" y="236" width="51" height="6" fill="#3f879d"/>
    <rect x="432" y="204" width="9" height="9" fill="#fff8ec"/>
    <rect x="445" y="198" width="19" height="16" fill="#fff8ec"/>
    <rect x="465" y="206" width="13" height="8" fill="#fff8ec"/>
    <rect x="456" y="195" width="6" height="6" fill="#fff8ec"/>
    <rect x="430" y="226" width="30" height="5" fill="#c5f0f2"/>

    <rect x="411" y="277" width="78" height="9" fill="#553b38" opacity=".28"/>
    <rect x="409" y="251" width="76" height="32" fill="#bd4f74"/>
    <rect x="409" y="244" width="76" height="12" fill="#e6788f"/>
    <rect x="416" y="239" width="31" height="23" fill="#fff0ce"/>
    <rect x="453" y="247" width="28" height="12" fill="#f3b4bd"/>
    <rect x="418" y="274" width="54" height="7" fill="#9c4263"/>
    <rect x="409" y="283" width="8" height="9" fill="#6a403d"/>
    <rect x="477" y="283" width="8" height="9" fill="#6a403d"/>

    <rect x="68" y="279" width="47" height="7" fill="#423833" opacity=".26"/>
    <rect x="63" y="270" width="55" height="18" fill="#f25f82"/>
    <rect x="66" y="265" width="9" height="23" fill="#f5d34a"/>
    <rect x="76" y="260" width="22" height="28" fill="#6fc18b"/>
    <rect x="98" y="267" width="16" height="21" fill="#f5d34a"/>
    <rect x="68" y="271" width="44" height="7" fill="#ffe889"/>
    <rect x="68" y="281" width="8" height="7" fill="#62b47d"/>
    <rect x="102" y="281" width="8" height="7" fill="#62b47d"/>

    <rect x="158" y="229" width="7" height="7" fill="#e9b94f"/>
    <rect x="377" y="227" width="7" height="7" fill="#e9b94f"/>
    <rect x="270" y="210" width="16" height="5" fill="#fff0bd"/>
    <rect x="118" y="252" width="35" height="5" fill="#d99569" opacity=".45"/>
    <rect x="418" y="318" width="35" height="5" fill="#d99569" opacity=".45"/>
  `);
}

function propSvg(kind) {
  const bodies = {
    food: pxSvg(96, 72, `
      <rect x="15" y="49" width="66" height="8" fill="#4d372f" opacity=".32"/>
      <rect x="16" y="31" width="65" height="18" fill="#823f3e"/>
      <rect x="19" y="29" width="59" height="19" fill="#c84f55"/>
      <rect x="24" y="24" width="50" height="13" fill="#f3d795"/>
      <rect x="29" y="21" width="40" height="8" fill="#fff1c1"/>
      <rect x="31" y="22" width="8" height="8" fill="#835336"/>
      <rect x="46" y="21" width="9" height="9" fill="#bd743b"/>
      <rect x="61" y="24" width="8" height="8" fill="#835336"/>
      <rect x="27" y="38" width="44" height="6" fill="#f18d7b"/>
      <rect x="36" y="44" width="26" height="4" fill="#743835"/>
      <rect x="22" y="47" width="52" height="3" fill="#6a3235"/>
    `),
    bath: pxSvg(128, 96, `
      <rect x="12" y="72" width="104" height="10" fill="#3b5360" opacity=".28"/>
      <rect x="13" y="43" width="102" height="31" fill="#3b839a"/>
      <rect x="17" y="39" width="94" height="32" fill="#67b8d0"/>
      <rect x="24" y="34" width="80" height="12" fill="#a8e1e9"/>
      <rect x="22" y="65" width="84" height="7" fill="#3f849b"/>
      <rect x="27" y="46" width="64" height="7" fill="#c6eef1"/>
      <rect x="29" y="20" width="20" height="14" fill="#fff8ea"/>
      <rect x="48" y="15" width="29" height="20" fill="#fff8ea"/>
      <rect x="76" y="23" width="27" height="12" fill="#fff8ea"/>
      <rect x="36" y="10" width="10" height="10" fill="#fff8ea"/>
      <rect x="82" y="8" width="10" height="10" fill="#fff8ea"/>
      <rect x="23" y="34" width="9" height="5" fill="#e1f4f3"/>
      <rect x="96" y="36" width="9" height="5" fill="#e1f4f3"/>
    `),
    bed: pxSvg(144, 96, `
      <rect x="13" y="73" width="118" height="11" fill="#493431" opacity=".3"/>
      <rect x="12" y="39" width="120" height="37" fill="#9f4263"/>
      <rect x="12" y="31" width="120" height="15" fill="#dc6f89"/>
      <rect x="21" y="25" width="48" height="31" fill="#fff0ce"/>
      <rect x="73" y="34" width="47" height="15" fill="#f4b4bf"/>
      <rect x="22" y="62" width="96" height="12" fill="#bd4d70"/>
      <rect x="28" y="66" width="84" height="5" fill="#e28299"/>
      <rect x="12" y="76" width="12" height="12" fill="#67413c"/>
      <rect x="120" y="76" width="12" height="12" fill="#67413c"/>
      <rect x="25" y="29" width="36" height="4" fill="#fff8e3"/>
      <rect x="82" y="36" width="26" height="4" fill="#ffd1d7"/>
    `),
    toy: pxSvg(72, 72, `
      <rect x="13" y="55" width="47" height="7" fill="#453a34" opacity=".28"/>
      <rect x="19" y="24" width="36" height="34" fill="#efc64a"/>
      <rect x="16" y="31" width="42" height="15" fill="#e35f79"/>
      <rect x="20" y="46" width="34" height="11" fill="#5eb883"/>
      <rect x="35" y="20" width="6" height="39" fill="#665041" opacity=".44"/>
      <rect x="24" y="25" width="6" height="6" fill="#fff0a9"/>
      <rect x="47" y="35" width="6" height="6" fill="#fff0a9"/>
      <rect x="22" y="49" width="8" height="7" fill="#7bc99a"/>
      <rect x="50" y="47" width="5" height="8" fill="#3f8b68"/>
    `),
    heart: pxSvg(80, 72, `
      <rect x="18" y="56" width="44" height="8" fill="#463238" opacity=".18"/>
      <rect x="17" y="19" width="16" height="16" fill="#d84e67"/>
      <rect x="31" y="14" width="13" height="19" fill="#d84e67"/>
      <rect x="44" y="19" width="16" height="16" fill="#d84e67"/>
      <rect x="22" y="34" width="34" height="13" fill="#d84e67"/>
      <rect x="29" y="47" width="20" height="11" fill="#d84e67"/>
      <rect x="35" y="58" width="8" height="6" fill="#d84e67"/>
      <rect x="45" y="18" width="8" height="5" fill="#f29baa"/>
      <rect x="55" y="35" width="13" height="10" fill="#e9798c"/>
      <rect x="22" y="20" width="5" height="5" fill="#ee8d9e"/>
    `),
  };
  return bodies[kind];
}

function foodLayerSvg(layer) {
  const layers = {
    back: pxSvg(96, 72, `
      <rect x="15" y="49" width="66" height="8" fill="#4d372f" opacity=".32"/>
      <rect x="16" y="31" width="65" height="18" fill="#823f3e"/>
      <rect x="19" y="29" width="59" height="19" fill="#c84f55"/>
      <rect x="24" y="24" width="50" height="13" fill="#8d4448"/>
      <rect x="27" y="26" width="44" height="8" fill="#74383d"/>
      <rect x="21" y="45" width="55" height="4" fill="#9d4447"/>
    `),
    mealFull: pxSvg(96, 72, `
      <rect x="24" y="24" width="50" height="13" fill="#f3d795"/>
      <rect x="29" y="21" width="40" height="8" fill="#fff1c1"/>
      <rect x="31" y="22" width="8" height="8" fill="#835336"/>
      <rect x="46" y="21" width="9" height="9" fill="#bd743b"/>
      <rect x="61" y="24" width="8" height="8" fill="#835336"/>
      <rect x="38" y="26" width="6" height="5" fill="#a06035"/>
      <rect x="54" y="25" width="7" height="5" fill="#fff4c9"/>
    `),
    mealLow: pxSvg(96, 72, `
      <rect x="29" y="28" width="38" height="8" fill="#e7c279"/>
      <rect x="36" y="25" width="10" height="7" fill="#835336"/>
      <rect x="53" y="26" width="8" height="7" fill="#bd743b"/>
      <rect x="63" y="30" width="6" height="5" fill="#fff1c1"/>
    `),
    front: pxSvg(96, 72, `
      <rect x="27" y="38" width="44" height="6" fill="#f18d7b"/>
      <rect x="36" y="44" width="26" height="4" fill="#743835"/>
      <rect x="22" y="47" width="52" height="3" fill="#6a3235"/>
      <rect x="19" y="43" width="59" height="6" fill="#b94850" opacity=".78"/>
    `),
  };
  return layers[layer];
}

function bathLayerSvg(layer) {
  const layers = {
    back: pxSvg(128, 96, `
      <rect x="12" y="72" width="104" height="10" fill="#3b5360" opacity=".28"/>
      <rect x="13" y="43" width="102" height="31" fill="#3b839a"/>
      <rect x="17" y="39" width="94" height="32" fill="#67b8d0"/>
      <rect x="24" y="34" width="80" height="12" fill="#a8e1e9"/>
      <rect x="22" y="65" width="84" height="7" fill="#3f849b"/>
    `),
    water: pxSvg(128, 96, `
      <rect x="27" y="46" width="64" height="7" fill="#c6eef1"/>
      <rect x="31" y="50" width="55" height="5" fill="#8fd8e3"/>
      <rect x="39" y="44" width="18" height="3" fill="#e9fbff"/>
      <rect x="69" y="45" width="14" height="3" fill="#e9fbff"/>
    `),
    bubbles: pxSvg(128, 96, `
      <rect x="29" y="20" width="20" height="14" fill="#fff8ea"/>
      <rect x="48" y="15" width="29" height="20" fill="#fff8ea"/>
      <rect x="76" y="23" width="27" height="12" fill="#fff8ea"/>
      <rect x="36" y="10" width="10" height="10" fill="#fff8ea"/>
      <rect x="82" y="8" width="10" height="10" fill="#fff8ea"/>
    `),
    front: pxSvg(128, 96, `
      <rect x="22" y="65" width="84" height="7" fill="#3f849b"/>
      <rect x="23" y="34" width="9" height="5" fill="#e1f4f3"/>
      <rect x="96" y="36" width="9" height="5" fill="#e1f4f3"/>
      <rect x="18" y="58" width="92" height="10" fill="#56a8c1" opacity=".9"/>
    `),
  };
  return layers[layer];
}

function bedLayerSvg(layer) {
  const layers = {
    back: pxSvg(144, 96, `
      <rect x="13" y="73" width="118" height="11" fill="#493431" opacity=".3"/>
      <rect x="12" y="39" width="120" height="37" fill="#9f4263"/>
      <rect x="12" y="31" width="120" height="15" fill="#dc6f89"/>
      <rect x="21" y="25" width="48" height="31" fill="#fff0ce"/>
      <rect x="73" y="34" width="47" height="15" fill="#f4b4bf"/>
    `),
    blanket: pxSvg(144, 96, `
      <rect x="22" y="55" width="96" height="19" fill="#bd4d70"/>
      <rect x="28" y="60" width="84" height="8" fill="#e28299"/>
      <rect x="32" y="58" width="12" height="6" fill="#f0a8b5"/>
      <rect x="54" y="62" width="14" height="5" fill="#9f4263"/>
      <rect x="84" y="58" width="18" height="6" fill="#f0a8b5"/>
    `),
    front: pxSvg(144, 96, `
      <rect x="22" y="62" width="96" height="12" fill="#bd4d70"/>
      <rect x="28" y="66" width="84" height="5" fill="#e28299"/>
      <rect x="12" y="76" width="12" height="12" fill="#67413c"/>
      <rect x="120" y="76" width="12" height="12" fill="#67413c"/>
    `),
  };
  return layers[layer];
}

function toyLayerSvg(layer) {
  const layers = {
    back: pxSvg(72, 72, `
      <rect x="13" y="55" width="47" height="7" fill="#453a34" opacity=".28"/>
      <rect x="19" y="24" width="36" height="34" fill="#efc64a"/>
      <rect x="16" y="31" width="42" height="15" fill="#e35f79"/>
      <rect x="20" y="46" width="34" height="11" fill="#5eb883"/>
    `),
    burst: pxSvg(72, 72, `
      <rect x="24" y="18" width="6" height="6" fill="#fff0a9"/>
      <rect x="47" y="24" width="6" height="6" fill="#fff0a9"/>
      <rect x="12" y="35" width="8" height="7" fill="#7bc99a"/>
      <rect x="55" y="38" width="5" height="8" fill="#3f8b68"/>
      <rect x="34" y="14" width="8" height="7" fill="#e35f79"/>
    `),
    front: pxSvg(72, 72, `
      <rect x="20" y="46" width="34" height="11" fill="#5eb883"/>
      <rect x="35" y="20" width="6" height="39" fill="#665041" opacity=".44"/>
      <rect x="22" y="49" width="8" height="7" fill="#7bc99a"/>
      <rect x="50" y="47" width="5" height="8" fill="#3f8b68"/>
    `),
  };
  return layers[layer];
}

function heartLayerSvg(layer) {
  const layers = {
    back: pxSvg(80, 72, `
      <rect x="18" y="56" width="44" height="8" fill="#463238" opacity=".18"/>
    `),
    pulse: pxSvg(80, 72, `
      <rect x="17" y="19" width="16" height="16" fill="#d84e67"/>
      <rect x="31" y="14" width="13" height="19" fill="#d84e67"/>
      <rect x="44" y="19" width="16" height="16" fill="#d84e67"/>
      <rect x="22" y="34" width="34" height="13" fill="#d84e67"/>
      <rect x="29" y="47" width="20" height="11" fill="#d84e67"/>
      <rect x="35" y="58" width="8" height="6" fill="#d84e67"/>
    `),
    front: pxSvg(80, 72, `
      <rect x="45" y="18" width="8" height="5" fill="#f29baa"/>
      <rect x="55" y="35" width="13" height="10" fill="#e9798c"/>
      <rect x="22" y="20" width="5" height="5" fill="#ee8d9e"/>
    `),
  };
  return layers[layer];
}

async function renderPixelAsset(name, buffer, width) {
  ensureDir(OUT_DIR);
  ensureDir(SRC_DIR);
  fs.writeFileSync(path.join(SRC_DIR, `${name}.svg`), buffer);
  await sharp(buffer)
    .resize({ width, kernel: sharp.kernel.nearest })
    .webp({ lossless: true, quality: 100 })
    .toFile(path.join(OUT_DIR, `${name}.webp`));
}

async function renderAcceptedFoodAssets() {
  ensureDir(OUT_DIR);
  ensureDir(SRC_DIR);
  const acceptedSource = path.join(
    ROOT,
    'assets-src',
    'yoyo',
    'redraw-runs',
    '2026-05-29-prop-food-candidate-01',
    'source-alpha.png',
  );
  const acceptedCandidate = path.join(ROOT, 'assets', 'yoyo', 'qa', 'candidates', 'home-prop-food-candidate-01.webp');
  const visibleSource = fs.existsSync(acceptedSource) ? acceptedSource : acceptedCandidate;
  const transparentPng = await sharp({
    create: { width: 210, height: 150, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  }).png().toBuffer();
  const transparentWebp = await sharp(transparentPng).webp({ lossless: true, quality: 100 }).toBuffer();

  await sharp(visibleSource).png().toFile(path.join(SRC_DIR, 'prop-food.png'));
  await sharp(visibleSource).png().toFile(path.join(SRC_DIR, 'prop-food-back.png'));
  await sharp(visibleSource)
    .resize({ width: 210, height: 150, fit: 'fill' })
    .webp({ lossless: true, quality: 100 })
    .toFile(path.join(OUT_DIR, 'prop-food.webp'));
  await sharp(visibleSource)
    .resize({ width: 210, height: 150, fit: 'fill' })
    .webp({ lossless: true, quality: 100 })
    .toFile(path.join(OUT_DIR, 'prop-food-back.webp'));

  for (const name of ['prop-food-meal-full', 'prop-food-meal-low', 'prop-food-front']) {
    fs.writeFileSync(path.join(SRC_DIR, `${name}.png`), transparentPng);
    fs.writeFileSync(path.join(OUT_DIR, `${name}.webp`), transparentWebp);
  }
}

async function renderRoomScene(scene) {
  const source = path.join(SRC_DIR, 'ai', scene.source);
  if (!fs.existsSync(source)) {
    if (scene.name !== 'default') return;
    await renderPixelAsset('room-stage-v2', roomSvg(), 1080);
    return;
  }

  ensureDir(OUT_DIR);
  ensureDir(path.join(SRC_DIR, 'aseprite'));
  const roomPng = path.join(SRC_DIR, 'aseprite', `yoyo-home-room-${scene.name}.png`);
  await sharp(source)
    .resize({ width: 1080, height: 720, fit: 'fill', kernel: sharp.kernel.nearest })
    .png()
    .toFile(roomPng);
  await sharp(roomPng)
    .webp({ lossless: true, quality: 100 })
    .toFile(path.join(OUT_DIR, `${scene.output}.webp`));

  if (fs.existsSync(ASEPRITE_BIN)) {
    const asepriteFile = path.join(SRC_DIR, 'aseprite', `yoyo-home-room-${scene.name}.aseprite`);
    execFileSync(ASEPRITE_BIN, ['--batch', roomPng, '--save-as', asepriteFile], { stdio: 'inherit' });
  }
}

async function buildHomeYoyoSheet() {
  const source = sharp(PET_SHEET).ensureAlpha();
  const { data, info } = await source.raw().toBuffer({ resolveWithObject: true });
  const shadow = Buffer.alloc(data.length);
  const dx = 3;
  const dy = 4;

  for (let y = 0; y < info.height - dy; y += 1) {
    for (let x = 0; x < info.width - dx; x += 1) {
      const index = (y * info.width + x) * 4;
      const alpha = data[index + 3];
      if (alpha <= 12) continue;
      const target = ((y + dy) * info.width + x + dx) * 4;
      shadow[target] = 42;
      shadow[target + 1] = 37;
      shadow[target + 2] = 50;
      shadow[target + 3] = Math.max(shadow[target + 3], Math.min(72, Math.round(alpha * 0.28)));
    }
  }

  const shadowPng = await sharp(shadow, {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();

  await sharp({
    create: {
      width: info.width,
      height: info.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      { input: shadowPng, left: 0, top: 0 },
      { input: PET_SHEET, left: 0, top: 0 },
    ])
    .webp({ lossless: true, quality: 100 })
    .toFile(path.join(OUT_DIR, 'yoyo-home-sheet.webp'));
}

async function main() {
  ensureDir(OUT_DIR);
  ensureDir(SRC_DIR);
  for (const scene of ROOM_SCENES) {
    await renderRoomScene(scene);
  }
  await renderAcceptedFoodAssets();
  await renderPixelAsset('prop-bath', propSvg('bath'), 180);
  await renderPixelAsset('prop-bath-back', bathLayerSvg('back'), 180);
  await renderPixelAsset('prop-bath-water', bathLayerSvg('water'), 180);
  await renderPixelAsset('prop-bath-bubbles', bathLayerSvg('bubbles'), 180);
  await renderPixelAsset('prop-bath-front', bathLayerSvg('front'), 180);
  await renderPixelAsset('prop-bed', propSvg('bed'), 216);
  await renderPixelAsset('prop-bed-back', bedLayerSvg('back'), 216);
  await renderPixelAsset('prop-bed-blanket', bedLayerSvg('blanket'), 216);
  await renderPixelAsset('prop-bed-front', bedLayerSvg('front'), 216);
  await renderPixelAsset('prop-toy', propSvg('toy'), 126);
  await renderPixelAsset('prop-toy-back', toyLayerSvg('back'), 126);
  await renderPixelAsset('prop-toy-burst', toyLayerSvg('burst'), 126);
  await renderPixelAsset('prop-toy-front', toyLayerSvg('front'), 126);
  await renderPixelAsset('prop-heart', propSvg('heart'), 142);
  await renderPixelAsset('prop-heart-back', heartLayerSvg('back'), 142);
  await renderPixelAsset('prop-heart-pulse', heartLayerSvg('pulse'), 142);
  await renderPixelAsset('prop-heart-front', heartLayerSvg('front'), 142);
  await buildHomeYoyoSheet();
  console.log(`Home pixel assets written to ${path.relative(ROOT, OUT_DIR)}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
