// clone-system.js - 分身术触发逻辑
// 分身术由签到/成就系统触发 window.petApi.triggerCloneEffect()
// 此模块为占位，确保模块结构完整

export function initCloneSystem() {
  // 分身术无需额外初始化，由主进程 IPC 处理
  // 触发点在：
  // - growth-system.js: 签到连续7天/30天
  // - growth-system.js: 特殊成就解锁
}
