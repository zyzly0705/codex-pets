export const EDGE_ORDER = ['bottom', 'right', 'top', 'left'];

const DEFAULTS = {
  speed: 6,
  edgeAttachMargin: 18,
  cornerTurnInset: 0,
  gravity: 3.6,
  maxFallSpeed: 18,
};

function number(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function boundsLimit(workArea, bounds) {
  return {
    minX: number(workArea.x),
    minY: number(workArea.y),
    maxX: number(workArea.x) + number(workArea.width) - number(bounds.width),
    maxY: number(workArea.y) + number(workArea.height) - number(bounds.height),
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function nextEdge(edge) {
  const index = EDGE_ORDER.indexOf(edge);
  return EDGE_ORDER[(index + 1 + EDGE_ORDER.length) % EDGE_ORDER.length] || 'bottom';
}

export function createEdgePatrolState(bounds = {}, workArea = {}, options = {}) {
  const edge = EDGE_ORDER.includes(options.edge) ? options.edge : nearestEdge(bounds, workArea);
  return {
    edge,
    gravityVy: 0,
    targetX: number(bounds.x),
    targetY: number(bounds.y),
  };
}

export function nearestEdge(bounds = {}, workArea = {}) {
  const limit = boundsLimit(workArea, bounds);
  const distances = {
    bottom: Math.abs(number(bounds.y) - limit.maxY),
    right: Math.abs(number(bounds.x) - limit.maxX),
    top: Math.abs(number(bounds.y) - limit.minY),
    left: Math.abs(number(bounds.x) - limit.minX),
  };
  return Object.entries(distances).sort((a, b) => a[1] - b[1])[0]?.[0] || 'bottom';
}

export function isAttachedToEdge(state = {}, bounds = {}, workArea = {}, options = {}) {
  const margin = number(options.edgeAttachMargin, DEFAULTS.edgeAttachMargin);
  const limit = boundsLimit(workArea, bounds);
  const edge = EDGE_ORDER.includes(state.edge) ? state.edge : nearestEdge(bounds, workArea);
  if (edge === 'bottom') return Math.abs(number(bounds.y) - limit.maxY) <= margin;
  if (edge === 'top') return Math.abs(number(bounds.y) - limit.minY) <= margin;
  if (edge === 'right') return Math.abs(number(bounds.x) - limit.maxX) <= margin;
  if (edge === 'left') return Math.abs(number(bounds.x) - limit.minX) <= margin;
  return false;
}

export function animationStateForStep(edge, delta = {}, mode = 'patrol') {
  if (mode === 'gravity') return 'jumping';
  if (edge === 'top') return 'runningLeft';
  if (edge === 'bottom') return 'runningRight';

  const dx = number(delta.x);
  const dy = number(delta.y);
  if (Math.abs(dy) > Math.abs(dx)) return dy < 0 ? 'runningLeft' : 'runningRight';
  return dx < 0 ? 'runningLeft' : 'runningRight';
}

export function applyGravityStep(state = {}, bounds = {}, workArea = {}, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const limit = boundsLimit(workArea, bounds);
  const currentX = number(bounds.x);
  const currentY = number(bounds.y);
  const floorY = limit.maxY;
  if (currentY >= floorY) {
    return {
      mode: 'patrol',
      delta: { x: 0, y: 0 },
      state: { ...state, edge: 'bottom', gravityVy: 0, targetX: number(bounds.x), targetY: floorY },
      stateName: 'runningRight',
      edge: 'bottom',
      target: { x: number(bounds.x), y: floorY },
    };
  }

  const nextVy = Math.min(number(opts.maxFallSpeed, DEFAULTS.maxFallSpeed), number(state.gravityVy) + number(opts.gravity, DEFAULTS.gravity));
  const nextY = Math.min(floorY, currentY + nextVy);
  const landed = nextY >= floorY;
  const nextState = {
    ...state,
    edge: landed ? 'bottom' : state.edge,
    gravityVy: landed ? 0 : nextVy,
  };
  return {
    mode: landed ? 'patrol' : 'gravity',
    delta: { x: 0, y: nextY - currentY },
    state: nextState,
    stateName: landed ? 'runningRight' : 'jumping',
    edge: nextState.edge || 'bottom',
    target: { x: currentX, y: nextY },
  };
}

export function stepEdgePatrol(state = {}, bounds = {}, workArea = {}, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  if (!isAttachedToEdge(state, bounds, workArea, opts)) {
    return applyGravityStep(state, bounds, workArea, opts);
  }

  const limit = boundsLimit(workArea, bounds);
  const speed = Math.max(1, number(opts.speed, DEFAULTS.speed));
  const edge = EDGE_ORDER.includes(state.edge) ? state.edge : nearestEdge(bounds, workArea);
  const currentX = number(state.targetX, bounds.x);
  const currentY = number(state.targetY, bounds.y);
  const maxInsetX = Math.max(0, (limit.maxX - limit.minX) / 3);
  const maxInsetY = Math.max(0, (limit.maxY - limit.minY) / 3);
  const turnInset = Math.max(0, Math.min(number(opts.cornerTurnInset, DEFAULTS.cornerTurnInset), maxInsetX, maxInsetY));
  const turnMinX = limit.minX + turnInset;
  const turnMaxX = limit.maxX - turnInset;
  const turnMinY = limit.minY + turnInset;
  const turnMaxY = limit.maxY - turnInset;
  let nextX = currentX;
  let nextY = currentY;
  let next = edge;

  if (edge === 'bottom') {
    nextX = Math.min(turnMaxX, currentX + speed);
    nextY = limit.maxY;
    if (nextX >= turnMaxX) next = 'right';
  } else if (edge === 'right') {
    nextX = limit.maxX;
    nextY = Math.max(turnMinY, currentY - speed);
    if (nextY <= turnMinY) next = 'top';
  } else if (edge === 'top') {
    nextX = Math.max(turnMinX, currentX - speed);
    nextY = limit.minY;
    if (nextX <= turnMinX) next = 'left';
  } else {
    nextX = limit.minX;
    nextY = Math.min(turnMaxY, currentY + speed);
    if (nextY >= turnMaxY) next = 'bottom';
  }

  const delta = {
    x: nextX - currentX,
    y: nextY - currentY,
  };
  const nextState = {
    ...state,
    edge: next,
    gravityVy: 0,
    targetX: nextX,
    targetY: nextY,
  };
  return {
    mode: 'patrol',
    delta,
    state: nextState,
    stateName: animationStateForStep(next, delta, 'patrol'),
    edge: next,
    target: { x: nextX, y: nextY },
  };
}
