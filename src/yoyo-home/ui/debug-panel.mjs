function formatNeed(value) {
  return String(Math.round(value));
}

export function createDebugPanel(root) {
  const panel = document.createElement('aside');
  panel.className = 'yoyo-home-debug';
  panel.innerHTML = `
    <strong>Yoyo Home Debug</strong>
    <dl>
      <dt>task</dt><dd data-debug="task">idle</dd>
      <dt>phase</dt><dd data-debug="phase">idle</dd>
      <dt>mode</dt><dd data-debug="mode">idle</dd>
      <dt>mini game</dt><dd data-debug="miniGame">none</dd>
      <dt>hunger</dt><dd data-debug="hunger">0</dd>
      <dt>mood</dt><dd data-debug="mood">0</dd>
      <dt>events</dt><dd data-debug="events">0</dd>
    </dl>
  `;
  root.append(panel);

  const read = (key) => panel.querySelector(`[data-debug="${key}"]`);
  return {
    element: panel,
    update(state) {
      read('task').textContent = state.currentTask?.actionId || 'idle';
      read('phase').textContent = state.currentTask?.lifecycle || 'idle';
      read('mode').textContent = state.activeTask?.mode || 'idle';
      read('miniGame').textContent = state.activeTask?.mode === 'miniGame' ? state.activeTask.gameId : 'none';
      read('hunger').textContent = formatNeed(state.needs.hunger);
      read('mood').textContent = formatNeed(state.needs.mood);
      read('events').textContent = String(state.eventLog.length);
    },
  };
}
