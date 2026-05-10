# 🎨 自定义指南

> 想让 Yoyo 记住你们的纪念日？想添加专属文案？想调整她的活跃度？这里有你需要的一切。

## 目录

- [如何修改纪念日日期](#如何修改纪念日日期)
- [如何添加自定义文案](#如何添加自定义文案)
- [如何调整行为频率](#如何调整行为频率)
- [如何替换宠物素材](#如何替换宠物素材)
- [设置面板功能说明](#设置面板功能说明)

---

## 如何修改纪念日日期

纪念日定义在 `src/renderer.js` 中的 `SPECIAL_DATES` 数组：

```javascript
const SPECIAL_DATES = [
  { month: 7, day: 5, type: 'birthday', messages: [...] },
  { month: 9, day: 28, type: 'anniversary', messages: [...] },
  { month: 9, day: 10, type: 'teachers_day', messages: [...] },
  { month: 5, day: -1, type: 'mothers_day', messages: [...] },  // -1 表示动态计算
];
```

### 修改示例

修改 Yoyo 的生日为 3 月 15 日：

```javascript
{ month: 3, day: 15, type: 'birthday', messages: ['今天是Yoyo的生日！妈妈记得吗？嘿嘿～'] }
```

### 添加新纪念日

```javascript
{ 
  month: 2, 
  day: 14, 
  type: 'valentines',  // 自定义类型名
  messages: [
    '情人节快乐！妈妈和爸爸要幸福哦～',
    '今天是爱的日子！Yoyo也爱妈妈！'
  ] 
}
```

### 纪念日特效

在 `checkSpecialDate()` 函数中可以给新类型添加特效：

```javascript
if (sd.type === 'valentines') {
  window.petApi.triggerEffect('heart');  // 爱心飘落
}
```

可用特效类型：`'heart'`（爱心）、`'flower'`（花瓣）、`'candy'`（糖果）

## 如何添加自定义文案

### 行为台词

在 `BEHAVIOR_LINES` 对象中为对应行为添加文案：

```javascript
const BEHAVIOR_LINES = {
  walk: [
    '妈妈～Yoyo散步去咯！',
    '走走看看有什么好玩的～',
    // 在这里添加新文案
    '妈妈一起来散步嘛～',
  ],
  // ...
};
```

### 情绪分层文案

如果想让文案根据情绪变化，可以修改对应的 dialogues 对象：

```javascript
const PET_DIALOGUES = {
  happy: ['新的开心文案！'],
  sad: ['新的伤心文案…'],
  angry: ['新的生气文案！'],
  // ...
};
```

### 提醒文案

修改 `DAILY_REMINDERS` 数组中的 `messages`：

```javascript
{
  id: 'lunch',
  hour: 12,
  minute: 0,
  state: 'waving',
  messages: [
    '妈妈！该吃饭啦，Yoyo也饿了～',
    // 添加你的文案
    '中午好！今天想吃什么好吃的？',
  ]
}
```

### 撒娇文案

在 `sweetTalk` 行为的 `onExecute()` 中修改：

```javascript
const lines = [
  '妈妈，Yoyo好爱你呀～',
  // 添加专属撒娇文案
  '妈妈今天有多爱Yoyo呀？嘿嘿～',
];
```

## 如何调整行为频率

### 方法一：设置面板（推荐）

右键菜单 → 设置 → 活跃度选项：

| 选项 | 效果 |
|------|------|
| 安静 | 阈值 +15，很少主动行动 |
| 正常 | 默认行为频率 |
| 活泼 | 阈值 -10，频繁互动 |

### 方法二：修改冷却时间

在 `BEHAVIORS` 数组中修改行为的 `cooldown` 值：

```javascript
{
  name: 'wave',
  cooldown: 120000, // 改为 60000 → 挥手频率翻倍
  // ...
}
```

### 方法三：修改基础阈值

在 `behaviorEngineTick()` 函数中修改：

```javascript
let threshold = 25; // 降低这个值 = 更活泼，提高 = 更安静
```

### 方法四：修改需求增长速度

```javascript
// 让 boredom 增长更快 = Yoyo 更快无聊 = 更频繁行动
petNeeds.boredom = Math.min(100, petNeeds.boredom + 0.05);  // 改为 0.1
```

## 如何替换宠物素材

### Spritesheet 规范

| 属性 | 值 |
|------|-----|
| 格式 | WebP（推荐）或 PNG |
| 列数 | **8 列**（每行最多 8 帧） |
| 每帧尺寸 | **192 × 208 像素** |
| 行数 | 至少 26 行（对应所有动画状态） |
| 总尺寸 | 1536 × (208 × 行数) |

### 动画行对照表

| 行号 | 动画状态 | 帧数 | 说明 |
|------|----------|------|------|
| 0 | idle | 6 | 站立呼吸 |
| 1 | runningRight | 8 | 向右跑 |
| 2 | runningLeft | 8 | 向左跑 |
| 3 | waving | 4 | 挥手 |
| 4 | jumping | 5 | 跳跃 |
| 5 | failed | 8 | 失落/委屈 |
| 6 | waiting | 6 | 等待 |
| 8 | review | 6 | 思考/观看 |
| 9 | climbing | 6 | 攀爬 |
| 10 | perching | 4 | 趴着 |
| 11 | petting | 4 | 被摸 |
| 12 | yawning | 5 | 打哈欠 |
| 13 | eating | 6 | 吃东西 |
| 14 | dizzy | 4 | 头晕 |
| 15 | lookingAround | 5 | 东张西望 |
| 16 | swing | 8 | 荡秋千 |
| 17 | digSand | 8 | 挖土 |
| 18 | readBook | 8 | 看书 |
| 19 | watchTV | 8 | 看电视 |
| 20 | sleeping | 8 | 睡觉 |
| 21 | dancing | 8 | 跳舞 |
| 22 | crying | 8 | 哭泣 |
| 23 | gifting | 8 | 送礼 |
| 24 | stretching | 8 | 伸懒腰 |
| 25 | clapping | 8 | 拍手 |

### 替换步骤

1. **准备素材**：制作符合规范的 spritesheet（8列×N行，每帧192×208）

2. **创建宠物目录**：

```
my-pet/
├── pet.json
└── spritesheet.webp
```

3. **编写 pet.json**：

```json
{
  "id": "my-pet",
  "displayName": "我的宠物",
  "description": "自定义宠物描述",
  "spritesheetPath": "spritesheet.webp"
}
```

4. **导入方式**：
   - 右键菜单 → 切换宠物 → 导入素材... → 选择宠物目录
   - 或手动复制到 `~Library/Application Support/codex-desktop-pet/pets/my-pet/`

### 素材不足时的降级

如果 spritesheet 行数不够（比如只做了前 16 行），系统会自动降级：

```javascript
// 当状态行超出素材实际行数时，回退到 idle
const maxRow = Math.floor(sprite.naturalHeight / CELL_H) - 1;
if (state.row > maxRow) {
  stateName = 'idle';
}
```

所以即使只做基础动画也能正常运行，高级动画会自动降级为 idle。

## 设置面板功能说明

右键菜单 → 设置，打开设置窗口：

| 设置项 | 说明 | 影响 |
|--------|------|------|
| **开机自启** | 开机时自动启动 Yoyo | 调用 `app.setLoginItemSettings()` |
| **音效** | Yoyo 的脚步声、笑声等 | 控制 `isMuted` 变量 |
| **提醒频率** | 喝水、吃饭等提醒的频率 | 高=全部，中=跳过部分喝水，低=仅重要 |
| **活跃度** | Yoyo 主动行动的频率 | quiet=+15阈值, normal=0, active=-10阈值 |
| **重置所有数据** | 清除所有记忆/成长/设置 | 清空 localStorage 并重载 |

### 提醒频率详情

| 频率 | 保留的提醒 | 跳过的提醒 |
|------|-----------|-----------|
| 高 | 全部 8 个提醒 | 无 |
| 中 | work-start, drink-10, lunch, dinner, work-end | drink-14, drink-16, drink-20 |
| 低 | work-start, lunch, work-end | 其他全部 |

### 设置存储位置

设置持久化在 `userData` 目录下的 `yoyo-settings.json`：

```json
{
  "autoStart": true,
  "soundEnabled": true,
  "reminderFreq": "medium",
  "activity": "normal"
}
```

---

*Yoyo 是独一无二的！就像妈妈对 Yoyo 的爱一样～*
