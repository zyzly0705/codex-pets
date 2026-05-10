# 🎀 Yoyo 桌面宠物（Codex Desktop Pet）

> 一只住在妈妈电脑里的小女孩，会撒娇、会关心你、会陪你加班到深夜。

**Yoyo 桌面宠物**是一款用 Electron 打造的桌面陪伴应用，宠物形象是 4-5 岁的小女孩 Yoyo。她会在屏幕上自由行走、攀爬窗口、跳舞卖萌，还会在妈妈加班时心疼地提醒休息，在纪念日送上满屏花瓣和祝福。

这是一份来自女儿的礼物 —— 即使不在身边，也想每天陪着妈妈。💝

<!-- 截图 -->

---

## ✨ 功能特点

### 🧠 三层行为引擎
- **StateMachine 三层架构**：`globalMode`（全局模式）→ `actionState`（行为状态）→ `effects`（叠加特效），统一管理所有状态转换
- **Utility AI 效用决策**：每 2 秒评估所有候选行为，评分流水线 `utilityFn → applyEmotionModifier → applyGrowthModifiers`
- **互斥组管理**：movement / interaction / specialty / punish 四组互斥，`canTransition()` 自动判断
- **统一锁管理 + 冷却同步**：`StateMachine.locks` 替代散落的 boolean 标志，菜单冷却实时同步
- **四维需求系统**：energy / boredom / hunger / playfulness 随时间自然衰减
- **定时器编排优化**：延迟启动、错开周期，天气更新即时触发行为决策
- **26 种动画状态**：行走、奔跑、跳跃、睡觉、吃东西、跳舞……栩栩如生

### 💖 情感系统
- **PAD 三维情感模型**（Pleasure-Arousal-Dominance）
- **大五人格参数**：赋予 Yoyo 独特性格
- **情感事件驱动**：互动影响心情，心情影响行为和文案语气

### 🧠 记忆系统
- 记录妈妈的使用模式（活跃时段、互动频率、陪伴天数）
- 精准触发个性化文案（"妈妈今天来得好早呀！"）
- localStorage 持久化，重启不丢失

### 🌱 成长系统
- **5 级成长路线**：小豆芽 → 小花苞 → 小蝴蝶 → 小公主 → 小天使
- **3 条进化路线**：活力线（小舞者）/ 温柔线（小书虫）/ 元气线（小助手），Lv.3 自动分化
- **成长影响行为偏好**：`applyGrowthModifiers` 根据等级和进化路线动态修饰行为评分
- **经验来源**：每日登录、抚摸、喂食、陪伴时长、里程碑成就、签到连击

### 🎮 交互系统
- **拖拽移动**：带物理效果（拉伸 / 摇摆 / 重力弹跳）
- **右键菜单**：跳舞 / 跟随鼠标 / 睡觉 / 设置
- **抚摸反应**：触发开心动画 → 连续抚摸进入呼噜阶段
- **鞭打三段反应**：挨打震颤 → 揉屁股 → 噘嘴撅屁股
- **喂食星星眼**：喂食时双眼变星星，伴随满足表情
- **辫子弹簧物理**：行走/跳跃时辫子自然摆动，带阻尼弹簧模拟
- **窗口攀爬**：趴在屏幕边缘、爬上其他窗口

### 💬 智能陪伴
- **工作陪伴**：检测 WPS 等办公软件，显示加油文案
- **加班心疼**：晚 8 点后 / 节假日工作时温柔提醒
- **生活提醒**：喝水、吃饭、上下班贴心提示
- **纪念日特效**：生日（7/5）、结婚纪念日（9/28）、教师节满屏祝福
- **繁忙检测**：长时间无互动时送上温馨关怀
- **天气 + 时段问候**：早安 / 午好 / 晚安，随天气变化表情

### 🎆 特效系统
- 满屏飘落特效：花瓣🌸 / 糖果🍬 / 心心❤️
- 法天象地巨大化特效（Lv.4 解锁，全屏放大 + 粒子爆发）
- 旋转飞入启动动画（首次启动，3 圈旋转 + easeOut 着陆 + 拖尾粒子）
- 分身术特效（签到连击/成就解锁触发）
- 纪念日 / 升级时自动触发，浪漫满分

### 🔔 音效系统
- Web Audio API 实时合成（无需外部音频文件）
- 5 种音效：脚步 / 笑声 / 哭声 / 弹跳 / 拍手
- 低音量设计不打扰工作，支持一键静音

### ⚙️ 系统集成
- 开机自启动
- 系统托盘图标（右键退出 / 显示）
- 关闭窗口时最小化到托盘
- 设置面板：提醒频率 / 音效开关 / 活跃度 / 自启管理

---

## 🚀 快速开始

### 环境要求

| 依赖 | 版本 |
|------|------|
| Node.js | >= 18 |
| npm | >= 9 |
| Electron | ^36.2.0 |

### 安装

```bash
git clone https://github.com/your-repo/codex-desktop-pet.git
cd codex-desktop-pet
npm install
```

### 启动开发模式

```bash
npm start
```

Yoyo 会出现在你的桌面右下角，开始她的冒险～

---

## 📦 打包发布

### Windows

```bash
npm run dist:win
```

生成 NSIS 安装包，输出到 `dist/` 目录。

### macOS

```bash
npx electron-builder --mac dmg
```

生成 `.dmg` 安装镜像。

---

## 📁 项目结构

```
codex-desktop-pet/
├── assets/xiao-hong/          # 宠物素材
│   ├── pet.json               # 动画配置（26种行为定义）
│   ├── spritesheet.webp       # 原始精灵图
│   └── spritesheet_expanded.webp  # 扩展精灵图（8×26格）
├── src/
│   ├── modules/               # ES Module 架构（12个模块）
│   │   ├── core-state.js      # 共享状态与常量（所有模块的基础层）
│   │   ├── state-machine.js   # 三层状态机引擎（globalMode/actionState/effects）
│   │   ├── emotion-system.js  # PAD 情感模型 + 大五人格
│   │   ├── growth-system.js   # 成长/签到/成就/进化路线
│   │   ├── behavior-engine.js # 行为注册与评分（Utility AI）
│   │   ├── interaction.js     # 交互反应系统（拖拽/喂食/鞭打/抚摸）
│   │   ├── climbing.js        # 攀爬系统
│   │   ├── weather-seasonal.js# 天气与季节粒子
│   │   ├── timers.js          # 定时器统一管理
│   │   ├── outfit-system.js   # 换装系统
│   │   ├── render-engine.js   # Canvas 渲染引擎 + 辫子物理
│   │   ├── startup-animation.js # 旋转飞入启动动画
│   │   └── clone-system.js    # 分身术特效
│   ├── renderer.js            # 模块入口（初始化与编排）
│   ├── main.js                # Electron 主进程（窗口/托盘/IPC）
│   ├── preload.js             # IPC 桥接
│   ├── index.html             # 宠物主窗口
│   ├── effect.html            # 特效覆盖窗口（花瓣/糖果/心心）
│   ├── giant-effect.html      # 法天象地巨大化特效窗口
│   ├── clone-effect.html      # 分身术特效窗口
│   ├── settings.html          # 设置面板
│   └── styles.css             # 样式
├── scripts/
│   └── expand-spritesheet.js  # 精灵图扩展工具
├── package.json
└── README.md
```

---

## 🏗️ 技术架构

### 三层状态机（StateMachine）

```
┌────────────────────────────────────────────────────┐
│  Layer 1: globalMode                                │
│    INTERACTIVE / AUTO_PLAY / SLEEP / FROZEN         │
│  ┌──────────────────────────────────────────────┐  │
│  │  Layer 2: actionState                         │  │
│  │    IDLE / WALKING / DANCING / CLIMBING / ...   │  │
│  │    互斥组：movement | interaction | specialty  │  │
│  │  ┌────────────────────────────────────────┐   │  │
│  │  │  Layer 3: effects (可叠加)              │   │  │
│  │  │    emotion_bubble / scale_animation /   │   │  │
│  │  │    seasonal_particles / clone_effect    │   │  │
│  │  └────────────────────────────────────────┘   │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### 行为引擎评分流水线

```
┌────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────┐
│ 需求池  │───→│ utilityFn │───→│ applyEmotion │───→│ applyGrowth  │───→│ 执行  │
└────────┘    └──────────┘    │  Modifier    │    │  Modifiers   │    └──────┘
 energy        候选行为评分     情感修饰        等级+进化路线修饰    选择最高分
 boredom                                                          播放动画
 hunger                                                           更新状态
 playfulness
```

### 情感模型（PAD）

- **P（Pleasure）**：愉悦度，受互动和事件影响
- **A（Arousal）**：唤醒度，影响行为活跃程度
- **D（Dominance）**：支配度，影响主动互动倾向

情感值缓慢衰减回归中性，不同情感状态映射不同文案风格。

### 记忆系统

```
localStorage
├── 使用模式：活跃时段统计、互动频率
├── 成长数据：等级、经验值、里程碑
├── 情感记录：近期情感事件
└── 陪伴统计：累计天数、连续天数
```

---

## ⚙️ 自定义配置

### 设置面板

启动后右键 Yoyo → 点击「设置」打开设置面板：

| 选项 | 说明 |
|------|------|
| 提醒频率 | 调节生活提醒的间隔时间 |
| 音效开关 | 开启/关闭所有音效 |
| 活跃度 | 调整 Yoyo 的行为频率 |
| 开机自启 | 是否随系统启动 |

### 修改纪念日

在 `src/renderer.js` 中找到纪念日配置区域，修改日期：

```javascript
// 纪念日配置
const ANNIVERSARIES = {
  birthday: { month: 7, day: 5 },        // Yoyo 生日
  wedding: { month: 9, day: 28 },        // 结婚纪念日
  teacherDay: { month: 9, day: 10 },     // 教师节
};
```

---

## 🍎 macOS 权限说明

Yoyo 的**窗口攀爬**功能需要使用 macOS 辅助功能权限来检测其他窗口的位置：

1. 打开 **系统设置 → 隐私与安全性 → 辅助功能**
2. 点击「+」添加 Yoyo 应用（或开发时的终端 / Electron）
3. 确保开关已开启

> 如果不授权，Yoyo 仍然可以正常使用，只是无法攀爬其他应用窗口。

---

## 📄 License

[MIT](LICENSE) © 2024

---

<p align="center">
  <i>「妈妈，Yoyo 会一直陪着你的～」</i> 💕
</p>
