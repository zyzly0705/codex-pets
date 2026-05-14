# 🎨 自定义指南

> 想让 Yoyo 记住你们的纪念日？想添加专属文案？想调整她的活跃度？这里有你需要的一切。

## 目录

- [如何修改纪念日日期](#如何修改纪念日日期)
- [如何添加自定义文案](#如何添加自定义文案)
- [如何调整行为频率](#如何调整行为频率)
- [如何替换宠物素材](#如何替换宠物素材)
- [素材分类与制作边界](#素材分类与制作边界)
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
| 26 | fanCooling | 8 | 吹风扇 |
| 27 | swimming | 8 | 游泳 |
| 28 | whip | 8 | 鞭打反应 |
| 29 | airConditioning | 8 | 吹空调 |
| 30 | sofaLying | 8 | 沙发躺 |
| 31 | ascension | 8 | 法相天地特效源 |
| 32 | typingCompanion | 8 | 键盘陪伴 |
| 33 | dharmaCharge | 8 | 法相天地蓄势 |
| 34 | dharmaSpirit | 8 | 法相天地元婴灵体 |
| 35 | dharmaManifest | 8 | 法相天地显化 |
| 36 | dharmaStable | 8 | 法相天地稳定威压 |

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

## 素材分类与制作边界

Yoyo 的素材不能全部用同一种做法。当前项目里同时存在角色动作、完整场景动作、换装图层和全屏特效源。如果混用，就会出现道具悬浮、脸部重复、空间关系错误、换装图层越界等问题。

### 推荐分类

| 分类 | 适用动作 | 制作方式 | 说明 |
|------|----------|----------|------|
| 基础角色动作 | `idle`、跑步、挥手、跳跃、等待、害羞、看向四周、睡觉、跳舞、哭泣、拍手等 | 主 spritesheet 逐帧 | 只表现角色本体姿态，适合稳定换装 |
| 道具动作 | `readBook`、`watchTV`、`gifting`、`digSand` | 主 spritesheet 逐帧，必要时含小道具 | 道具贴近身体且不需要复杂空间透视时可以保留在角色帧里 |
| 完整场景动作 | `swing`、`fanCooling`、`swimming`、`whip`、`airConditioning`、`sofaLying`、`typingCompanion` | 必须整帧逐帧绘制 | 有空间关系、遮挡、支撑点、前后景的动作不能靠运行时贴片拼 |
| 全屏特效源 | `ascension`、`dharmaCharge`、`dharmaSpirit`、`dharmaManifest`、`dharmaStable` / 法相天地 | 独立特效窗口使用 | 不建议当普通行为素材参与换装和日常动作 |
| 换装图层 | 发饰、帽子、衣服、背部配件 | 单独透明图层 spritesheet | 只适合跟随角色身体，不适合承载复杂场景 |
| 运行时特效 | 粒子、背景光、爱心、法阵、天气粒子 | Canvas 动态绘制 | 只画环境和氛围，不画五官、身体和关键道具 |

### 可以继续用的动作

这些动作是角色本体或轻道具动作，可以继续放在主 spritesheet 中，并允许换装图层跟随：

`idle`、`runningRight`、`runningLeft`、`waving`、`jumping`、`failed`、`waiting`、`bashful`、`review`、`perching`、`petting`、`yawning`、`eating`、`dizzy`、`lookingAround`、`digSand`、`readBook`、`watchTV`、`sleeping`、`dancing`、`crying`、`gifting`、`stretching`、`clapping`。

### 必须完整逐帧重画的动作

这些动作不应该用“角色 + 道具贴片”的方式拼：

| 动作 | 原因 |
|------|------|
| `swing` | 秋千有绳子、座板、摆动角度和支撑关系，必须整帧处理 |
| `fanCooling` | 风扇、风线、角色站位需要固定空间关系 |
| `swimming` | 水面、泳圈、遮挡关系必须整体绘制 |
| `whip` | 鞭子方向、受击姿态、泪水和身体反应必须同帧设计 |
| `airConditioning` | 空调不能挂在头上，必须有相对位置和冷风区域 |
| `sofaLying` | 沙发、靠垫、身体躺姿、遮挡必须整体绘制 |
| `typingCompanion` | 屏幕、桌面、键盘、角色站位必须整体绘制 |

### 不建议继续使用的做法

- 不要运行时硬贴五官。原始像素帧已有脸，再叠一套动态眼睛/嘴巴容易出现“双脸”或“额头脸”。
- 不要用单个 SVG 道具贴所有动作。动作帧的头身角度、遮挡和透视不同，固定锚点很容易漂。
- 不要把沙发、泳池、秋千、空调、键盘这类场景拆成孤立贴片。
- 不要在普通 spritesheet 里塞大量松散光效、阴影、文字、说明、UI 面板。
- 不要让换装图层承担完整场景职责。换装只负责衣服、帽子、发饰、背部小配件。

### 换装图层限制

主 spritesheet 当前可以超过 26 行，但旧换装图层大多只有 26 行。渲染层会跳过行数不足的换装图层，避免越界绘制。

这意味着：`fanCooling`、`swimming`、`whip`、`airConditioning`、`sofaLying`、`ascension`、`typingCompanion`、`dharmaCharge`、`dharmaSpirit`、`dharmaManifest`、`dharmaStable` 等新增动作上，旧换装可能不会显示。这是有意的安全降级。若这些动作必须支持换装，需要为对应换装项补齐同样行数的透明图层，或直接做带装扮的完整动作帧。

### 可归档或删除的素材

以下素材当前不是运行必需：

| 文件 | 处理建议 |
|------|----------|
| `spritesheet_face_*.webp` | 表情换装已禁用，动态五官也关闭；除非恢复整张表情 spritesheet 方案，否则可归档 |
| `spritesheet_before_ascension_row.webp` | 历史备份，可移出 assets 或删除 |
| `spritesheet_before_typing_row.webp` | 历史备份，可移出 assets 或删除 |
| `spritesheet_before_dharma_rows.webp` | 法相天地分阶段素材生成前的历史备份，可移出 assets 或删除 |

正式打包已排除 `*backup*`、`*before_generated*` 等文件，但本地仓库体积仍会受这些备份影响。清理前建议先确认是否还需要回滚素材。

### 新动作制作规则

新增动作时先判断它属于哪类：

1. 只有角色姿态变化：放主 spritesheet，逐帧画。
2. 小道具贴身且无复杂遮挡：可以放主 spritesheet，必要时做换装图层。
3. 有场景、支撑、前后景、遮挡或空间透视：必须完整逐帧画，不能运行时拼。
4. 只是氛围、粒子、背景光：用 Canvas 运行时特效，不进主 spritesheet。
5. 脸部表情：优先做逐帧表情素材，不要运行时覆盖五官。

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
