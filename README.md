# Codex Desktop Pet

Windows 桌面萌宠程序。安装后会显示一个透明置顶的小宠物窗口，默认内置 `Xiao Hong`，也可以手工导入其他 Codex pet 素材。

## 素材格式

导入目录需要包含：

```text
pet.json
spritesheet.webp
```

`pet.json` 示例：

```json
{
  "id": "xiao-hong",
  "displayName": "Xiao Hong",
  "description": "A tiny desktop pet.",
  "spritesheetPath": "spritesheet.webp"
}
```

贴图规格沿用 Codex pet atlas：

- 1536 x 1872
- 8 列 x 9 行
- 每格 192 x 208
- 行顺序：idle, running-right, running-left, waving, jumping, failed, waiting, running, review

## 功能

- 透明置顶桌面宠物
- 拖拽移动
- 自动在桌面左右走动
- 双击触发温馨提示
- 根据天气和时间切换表情与文案
- 手工导入宠物素材

## 开发运行

```bash
npm install
npm run start
```

## Windows 安装包

在 Windows 或 GitHub Actions Windows runner 上执行：

```bash
npm install
npm run dist:win
```

输出：

```text
dist/CodexDesktopPetSetup-0.1.0.exe
```
