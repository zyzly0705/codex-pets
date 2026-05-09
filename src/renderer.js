const canvas = document.getElementById('petCanvas');
const ctx = canvas.getContext('2d');
const bubble = document.getElementById('bubble');
const settingsButton = document.getElementById('settingsButton');
const settingsPanel = document.getElementById('settingsPanel');
const petSelect = document.getElementById('petSelect');
const cityInput = document.getElementById('cityInput');
const refreshWeather = document.getElementById('refreshWeather');
const importPet = document.getElementById('importPet');

const CELL_W = 192;
const CELL_H = 208;
const STATES = {
  idle: { row: 0, frames: 6, fps: 4 },
  runningRight: { row: 1, frames: 8, fps: 8 },
  runningLeft: { row: 2, frames: 8, fps: 8 },
  waving: { row: 3, frames: 4, fps: 4 },
  jumping: { row: 4, frames: 5, fps: 7 },
  failed: { row: 5, frames: 8, fps: 4 },
  waiting: { row: 6, frames: 6, fps: 3 },
  running: { row: 7, frames: 6, fps: 5 },
  review: { row: 8, frames: 6, fps: 4 }
};

const DEFAULT_CITY = 'Shanghai';
const WEATHER_CODES = new Map([
  [0, 'clear'],
  [1, 'clear'],
  [2, 'cloudy'],
  [3, 'cloudy'],
  [45, 'fog'],
  [48, 'fog'],
  [51, 'rain'],
  [53, 'rain'],
  [55, 'rain'],
  [61, 'rain'],
  [63, 'rain'],
  [65, 'rain'],
  [71, 'snow'],
  [73, 'snow'],
  [75, 'snow'],
  [95, 'storm']
]);

let pets = [];
let currentPet;
let sprite = new Image();
let stateName = 'idle';
let frame = 0;
let lastFrameAt = 0;
let messageTimer;
let weatherContext = null;
let walkIntent = null;
let dragState = null;

function localFileUrl(filePath) {
  return `file://${filePath.replaceAll('\\', '/')}`;
}

async function loadPets() {
  pets = await window.petApi.listPets();
  petSelect.innerHTML = '';
  for (const pet of pets) {
    const option = document.createElement('option');
    option.value = pet.id;
    option.textContent = pet.displayName;
    petSelect.appendChild(option);
  }
  await choosePet(pets[0]?.id);
}

async function choosePet(id) {
  currentPet = pets.find((pet) => pet.id === id) || pets[0];
  if (!currentPet) return;
  petSelect.value = currentPet.id;
  sprite = new Image();
  sprite.onload = () => {
    setState('idle');
    say(`${currentPet.displayName} 来啦。`);
  };
  sprite.src = localFileUrl(currentPet.spritesheetPath);
}

function setState(next) {
  if (!STATES[next]) return;
  if (stateName !== next) {
    stateName = next;
    frame = 0;
    lastFrameAt = 0;
  }
}

function draw(now) {
  requestAnimationFrame(draw);
  if (!sprite.complete || !sprite.naturalWidth) return;
  const state = STATES[stateName];
  if (!lastFrameAt || now - lastFrameAt >= 1000 / state.fps) {
    frame = (frame + 1) % state.frames;
    lastFrameAt = now;
  }
  ctx.clearRect(0, 0, CELL_W, CELL_H);
  ctx.drawImage(sprite, frame * CELL_W, state.row * CELL_H, CELL_W, CELL_H, 0, 0, CELL_W, CELL_H);
}

function say(text, duration = 5200) {
  clearTimeout(messageTimer);
  bubble.textContent = text;
  bubble.classList.add('visible');
  messageTimer = setTimeout(() => bubble.classList.remove('visible'), duration);
}

function weatherMood(current) {
  if (!current) return null;
  const kind = WEATHER_CODES.get(current.weather_code) || 'cloudy';
  const temp = Number(current.temperature_2m);
  const wind = Number(current.wind_speed_10m);
  if (kind === 'rain') return { state: 'waiting', text: `外面在下雨，记得带伞。慢一点也没关系。` };
  if (kind === 'snow') return { state: 'jumping', text: `下雪啦，今天适合喝点热的。` };
  if (kind === 'storm') return { state: 'failed', text: `天气有点凶，先把窗关好。` };
  if (temp >= 30) return { state: 'waiting', text: `今天有点热，水杯放近一点。` };
  if (temp <= 5) return { state: 'waiting', text: `外面冷，出门多穿一件。` };
  if (wind >= 28) return { state: 'review', text: `风有点大，桌面上的事也慢慢来。` };
  if (kind === 'clear') return { state: 'waving', text: `天气不错，今天也要稳稳地推进。` };
  return { state: 'idle', text: `云有点多，但你这边看起来很安静。` };
}

function timeMood() {
  const hour = new Date().getHours();
  if (hour < 6) return { state: 'waiting', text: '还很晚，困了就先休息。' };
  if (hour < 9) return { state: 'waving', text: '早呀，先从最小的一件事开始。' };
  if (hour < 12) return { state: 'running', text: '上午适合专注，小红陪你跑一会儿。' };
  if (hour < 14) return { state: 'idle', text: '午后缓一下，眼睛也休息一会儿。' };
  if (hour < 18) return { state: 'review', text: '下午适合检查细节，别被小问题卡太久。' };
  if (hour < 22) return { state: 'waiting', text: '晚上了，收个尾就很好。' };
  return { state: 'failed', text: '太晚啦，小红先皱眉提醒你休息。' };
}

async function refreshWeatherContext() {
  const city = cityInput.value.trim() || DEFAULT_CITY;
  localStorage.setItem('pet.city', city);
  try {
    const result = await window.petApi.getWeather(city);
    if (result.ok) {
      weatherContext = result;
      const mood = weatherMood(result.current);
      setState(mood.state);
      say(`${result.place}：${mood.text}`);
      return;
    }
    say(result.error || '天气没有取到，先按时间陪你。');
  } catch {
    say('天气暂时连不上，先按本地时间陪你。');
  }
  const fallback = timeMood();
  setState(fallback.state);
  say(fallback.text);
}

async function stepAround() {
  if (dragState) return;
  const { bounds, workArea } = await window.petApi.getBounds();
  if (!walkIntent || Math.random() < 0.28) {
    const direction = Math.random() > 0.5 ? 1 : -1;
    const distance = 90 + Math.random() * 180;
    walkIntent = {
      remaining: distance,
      dx: direction * 3,
      state: direction > 0 ? 'runningRight' : 'runningLeft'
    };
  }
  if (walkIntent.remaining > 0) {
    setState(walkIntent.state);
    const moved = await window.petApi.moveBy({ x: walkIntent.dx, y: 0 });
    walkIntent.remaining -= Math.abs(walkIntent.dx);
    if (moved.x <= workArea.x || moved.x + bounds.width >= workArea.x + workArea.width) {
      walkIntent.remaining = 0;
    }
  } else {
    walkIntent = null;
    setState(Math.random() > 0.75 ? 'waiting' : 'idle');
  }
}

function randomBehavior() {
  if (dragState) return;
  const mood = weatherContext ? weatherMood(weatherContext.current) : timeMood();
  const roll = Math.random();
  if (roll < 0.18) {
    setState('waving');
    say('我在桌面巡逻，看到你啦。');
  } else if (roll < 0.30) {
    setState('jumping');
  } else if (roll < 0.48) {
    setState(mood.state);
    say(mood.text);
  }
}

canvas.addEventListener('pointerdown', async (event) => {
  canvas.setPointerCapture(event.pointerId);
  dragState = { x: event.screenX, y: event.screenY };
  setState('jumping');
  await window.petApi.setIgnoreMouse(false);
});

canvas.addEventListener('pointermove', async (event) => {
  if (!dragState) return;
  const dx = event.screenX - dragState.x;
  const dy = event.screenY - dragState.y;
  dragState = { x: event.screenX, y: event.screenY };
  await window.petApi.moveBy({ x: dx, y: dy });
});

canvas.addEventListener('pointerup', () => {
  dragState = null;
  setState('idle');
  say('放这里也可以。');
});

canvas.addEventListener('dblclick', () => {
  const mood = weatherContext ? weatherMood(weatherContext.current) : timeMood();
  setState(mood.state);
  say(mood.text);
});

settingsButton.addEventListener('click', () => {
  settingsPanel.classList.toggle('hidden');
});

petSelect.addEventListener('change', () => choosePet(petSelect.value));
refreshWeather.addEventListener('click', refreshWeatherContext);
importPet.addEventListener('click', async () => {
  const result = await window.petApi.importPet();
  if (result.ok) {
    pets = result.pets;
    await loadPets();
    await choosePet(result.pet.id);
    say('新素材导入好了。');
  } else if (result.error) {
    say(result.error);
  }
});

window.petApi.onOpenImport(() => importPet.click());

cityInput.value = localStorage.getItem('pet.city') || DEFAULT_CITY;
loadPets().then(refreshWeatherContext);
requestAnimationFrame(draw);
setInterval(stepAround, 80);
setInterval(randomBehavior, 15000);
setInterval(refreshWeatherContext, 30 * 60 * 1000);
