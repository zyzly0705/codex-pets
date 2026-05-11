// store-client.js - 持久化存储客户端
// 所有数据在启动时一次性加载到内存缓存，读操作同步，写操作 fire-and-forget。
// 主进程（main.js）是数据的唯一持久化方，renderer 只操作缓存副本。

let _cache = null;

/** 启动时调用一次，加载全部数据到内存 */
export async function initStore() {
  _cache = await window.petApi.storeLoad();
  return _cache;
}

/** 同步读取缓存中的顶层字段 */
export function get(key) {
  return _cache?.[key] ?? null;
}

/** 同步写缓存 + 异步持久化（fire-and-forget） */
export function set(key, value) {
  if (_cache) _cache[key] = value;
  window.petApi.storeSet(key, value);
}

/** 批量写：一次 IPC 传多个字段，减少消息数量 */
export function batch(updates) {
  if (_cache) Object.assign(_cache, updates);
  window.petApi.storeBatch(updates);
}
