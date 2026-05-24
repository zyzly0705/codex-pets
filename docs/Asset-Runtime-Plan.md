# 素材与运行时改造 TODO

这份 TODO 对应当前项目从 `hatch-pet` 产物扩展成 Electron 桌宠运行时后的长期结构。

## 已落地

1. 主进程已拆分
   - `src/main.js` 只负责启动和模块装配。
   - 领域模块放在 `src/main/`：Store、窗口、托盘菜单、宠物、特效、天气、AI、新闻、系统检测、自动更新。

2. `pet.json` 支持多 sheet
   - `sheets.base` 指向主素材。
   - 每个 state 可以继续用主图，也可以用 `sheet` 或 `sheetPath` 指向独立动作图。

3. 新增动作不再必须塞进主大图
   - 主 `spritesheet.webp` 保留基础生命动作。
   - 后续新动作可以作为单行动作 strip 或 action pack 接入。

4. 换装收缩为 look 套装方向
   - `looks.default` 是默认完整造型。
   - 后续新增套装应该优先作为完整 look sheet，而不是自由叠帽子、衣服、翅膀。
   - 运行时不再支持旧 layer 换装。

5. `hatch-pet` 边界明确
   - `hatch-pet` 负责生成基础宠物、动作行、QA 和标准 Codex atlas。
   - 本项目负责 Electron 运行时、行为系统、多 sheet 组合、look 切换和桌面特效。

## 后续新增动作标准

优先顺序：

1. 能用渲染变换表达的动作，不新增素材。
2. 需要新姿态但不改变整套形象的动作，做独立 action sheet。
3. 改变衣服、轮廓、识别点的动作或造型，做完整 look sheet。

推荐 state 写法：

```json
"coffeeBreak": {
  "sheet": "work",
  "row": 0,
  "frames": 8,
  "fps": 5
}
```

推荐 sheet 写法：

```json
"sheets": {
  "base": "spritesheet.webp",
  "work": "actions/work.webp"
}
```

## 后续新增套装标准

推荐 look 写法：

```json
"looks": {
  "default": {
    "name": "默认",
    "spritesheetPath": "spritesheet.webp"
  },
  "warm": {
    "name": "暖暖套装",
    "spritesheetPath": "looks/warm/spritesheet.webp"
  }
}
```

约束：

- 大型装饰、衣服、帽子、翅膀、围巾应烘焙进 look sheet。
- 运行时叠加只保留小表情、粒子和轻量效果，不再叠加服装或大型装饰 layer。
- `gugu-gaga` 这类特殊形态继续保持 `outfit: false`。
