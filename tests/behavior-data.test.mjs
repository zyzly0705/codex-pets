// tests/behavior-data.test.mjs
// 验证 behavior-data.js 的数据完整性：所有行为都有 BEHAVIOR_META 条目和非空台词
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// 解析 behavior-data.js 中的 BEHAVIOR_META 和 BEHAVIOR_DIALOGUES
// 直接读文件提取键名，避免 ES module import 带来的 browser-dep 问题
const src = readFileSync(join(__dirname, '../src/modules/behavior-data.js'), 'utf-8');

function extractObjectKeys(src, objectName) {
  const re = new RegExp(`export const ${objectName}\\s*=\\s*\\{([\\s\\S]*?)^\\}`, 'm');
  const match = src.match(re);
  if (!match) return [];
  const body = match[1];
  const keys = [];
  for (const m of body.matchAll(/^\s{2}(\w+)\s*:/gm)) keys.push(m[1]);
  return keys;
}

const metaKeys      = extractObjectKeys(src, 'BEHAVIOR_META');
const dialogueKeys  = extractObjectKeys(src, 'BEHAVIOR_DIALOGUES');

// 从 behavior-engine.js 提取所有 name: '...' 条目
const engineSrc = readFileSync(join(__dirname, '../src/modules/behavior-engine.js'), 'utf-8');
const behaviorNames = [...engineSrc.matchAll(/name:\s*'(\w+)'/g)].map(m => m[1]);

describe('BEHAVIOR_META 完整性', () => {
  test('BEHAVIOR_META 中的键与 behavior-engine 中的行为名一致', () => {
    const missing = behaviorNames.filter(n => !metaKeys.includes(n));
    assert.deepEqual(missing, [], `缺少 BEHAVIOR_META 条目: ${missing.join(', ')}`);
  });

  test('BEHAVIOR_META 不为空', () => {
    assert.ok(metaKeys.length > 0, 'BEHAVIOR_META 应有条目');
  });
});

describe('BEHAVIOR_DIALOGUES 完整性', () => {
  test('BEHAVIOR_DIALOGUES 中有台词的行为都不为空数组', () => {
    // 通过正则提取每个台词数组的内容
    const emptyArrayRe = /(\w+):\s*\[\s*\]/g;
    const emptyKeys = [];
    for (const m of src.matchAll(emptyArrayRe)) {
      if (dialogueKeys.includes(m[1])) emptyKeys.push(m[1]);
    }
    // idle 是允许为空的
    const problematic = emptyKeys.filter(k => k !== 'idle');
    assert.deepEqual(problematic, [], `以下行为有空台词数组: ${problematic.join(', ')}`);
  });

  test('三个新增情绪溢出行为都有台词', () => {
    const required = ['neglectProtest', 'sadnessLinger', 'joySpill'];
    const missing = required.filter(k => !dialogueKeys.includes(k));
    assert.deepEqual(missing, [], `缺少台词: ${missing.join(', ')}`);
  });
});
