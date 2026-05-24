# Animation V2 TODO

Yoyo 的复杂动作不再按“换一个 state + 弹一句话”处理。复杂动作必须作为一段表演交付：场景、动作、微表情、台词、打断规则和结束状态要同步。

## 动作分类

- `character-only`：透明人物动作。适合 `idle`、`waving`、`bashful`、`petting`。
- `mini-scene`：192x208 内的小场景动作。适合 `swing`、`fanCooling`、`swimming`、`airConditioning`、`sofaLying`。
- `fullscreen-performance`：独立全屏演出。适合 `dance`、`clone`、`giant/dharma`。
- `prop-attached`：道具和身体强绑定。适合 `whip`、`readBook`、`watchTV`、`digSand`。
- `ambient-overlay`：播报、天气、新闻、心情粒子，不应抢复杂动作的表演权。

代码入口：`src/modules/action-taxonomy.js`。

## 表演脚本

复杂动作统一进入 `src/modules/performance-script.js`。

每段表演至少定义：

- `behavior`：行为名，用于日志和行为锁。
- `state`：角色基础状态。
- `duration`：表演时长。
- `lock`：是否禁止自然行为打断。
- `endState`：结束后回到的状态。
- `emotion`：对情绪系统的影响。
- `timeline`：台词、微表情、状态切换的时间轴。

当前脚本：

- `danceLetGo`
- `swingScene`
- `fanCoolingScene`
- `swimmingScene`
- `airConditioningScene`
- `sofaLyingScene`
- `cloneHeart`
- `dharmaManifest`

## 素材交付标准

### 帧数标准

当前运行时已支持三种播放方式：

- `loop: "pingpong"`：适合待机、摸摸、打盹、看书这类非循环位移动作，避免最后一帧突然跳回第一帧。
- `sequence`：手动声明任意 `{ row, frame }` 播放顺序，适合从多行里挑关键帧组成长动作。
- `clips`：一个动作跨多行连续播放，例如 3 行 x 8 格组成 24 帧。

后续新素材不再按“一个动作最多 8 帧”设计。推荐最低标准：

- 常驻高频动作：`idle`、`waiting`、`petting` 至少 12-16 播放帧。
- 照顾动作：`eating`、`sleeping`、`yawning`、`sofaLying` 至少 16 播放帧。
- mini-scene：`fanCooling`、`swimming`、`airConditioning` 至少 24 帧。
- 表演动作：`dance`、`clone`、`dharma` 至少 24 帧或 PixiJS timeline。

### mini-scene

适用动作：`swing`、`fanCooling`、`swimming`、`airConditioning`、`sofaLying`。

必须交付：

- 完整小场景背景，不允许道具漂浮在角色身上。
- 角色和道具在同一透视里。
- 关键姿势：准备、发力/进入、过程、缓冲、收势。
- 表情变化：至少 3 个情绪节点。
- Aseprite 源文件放到 `assets-src/yoyo/aseprite/`。
- 导出帧放到 `assets-src/yoyo/frames/<action>/`。
- QA 预览放到 `assets-src/yoyo/qa/`。

### fullscreen-performance

适用动作：`dance`、`clone`、`dharma`。

必须交付：

- 分身术、法相天地优先使用 PixiJS 实时舞台，不再烘焙大尺寸全屏 sheet。
- Yoyo 本体继续从原始 spritesheet 抽帧，避免动作一多就重画整图。
- 特效由 timeline 控制时长、数量、颜色、节奏和镜头感。
- 需要独立设计的素材应是小件：符文圈、闪电、粒子、冲击波、背后法相。
- 最后必须有收束，不允许突然消失。
- 运行时 timeline 放到 `assets/yoyo/effects/<effect-name>/timeline.json`。

V5 已废弃第三版的大 sheet 效果包和第四版手写 Canvas 编排。分身术和法相天地由 `src/pixi-effect-stage.js` 实时绘制，使用 PixiJS、pixi-filters 和 `@pixi/particle-emitter`：

- `clone-heart`：约 2.1 秒，9 个分身，暖金/粉色为主，少量青白点缀。
- `dharma-manifest`：约 4.1 秒，前景保留原色 Yoyo，背后半透明巨大法相，金色符文、冲击波和青白闪电。

当前约定：

- `assets-src/yoyo/effects/<effect-name>/timeline.json` 是设计源配置。
- `assets/yoyo/effects/<effect-name>/timeline.json` 是运行时配置。
- 不再提交 `effect.json`、`background.webp`、`character.webp` 这类全屏大 sheet 作为分身/法相运行时素材。

## 调度规则

- 手动触发最高优先级。
- 复杂动作播放期间，天气、新闻、自然行为不能打断。
- 自动触发复杂动作需要更高评分阈值。
- 播报类台词不能和表演类动作混用。
- `performance_started`、`performance_event`、`performance_ended` 必须进入 debug 日志。
- `behavior_committed` 继续记录最终实际播放状态。

## 第一批重做顺序

1. `danceLetGo`：已经拆成 24 帧独立序列。
2. `swingScene`：下一步应在 Aseprite 里画完整秋千架、绳子、座板和重心摆动。
3. `sofaLyingScene`：需要重画坐下、侧躺、陷入坐垫、放松。
4. `fanCoolingScene` / `airConditioningScene`：需要固定风源位置，身体和头发响应风向。
5. `swimmingScene`：需要水面、浮力、水花和划水姿势。
6. `cloneHeart`：已切到 V5 Pixi 舞台，下一步调 timeline、emitter 和小特效素材。
7. `dharmaManifest`：已切到 V5 Pixi 舞台，下一步优化法相背影、冲击波和闪电层次。
