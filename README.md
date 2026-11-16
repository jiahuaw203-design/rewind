# 请勿倒带 / Rewind

一盘没有标签的 90 年代录像带。纯文字微恐网页游戏，无框架、无构建工具。

> 状态：**阶段四（工程骨架）**。当前 `index.html` 是自检页，不是游戏本体。
> 引擎与剧情在阶段五接入。

## 目录结构

```
rewind/
├─ index.html          自检页（阶段五会被真正的标题页替换）
├─ preview.html        场景主题预览页：七个场景一键切换，看切换手感
├─ css/
│  ├─ base.css         骨架：底色/字体/HUD/正文/选项（颜色全部走 CSS 变量）
│  ├─ scenes.css       七套场景主题 + 雪花擦除切换
│  └─ effects.css      七种文字特效：血/抖/吃/打字/闪/码/扫描
├─ js/
│  ├─ engine.js        通用引擎（占位，阶段五实现）
│  ├─ effects.js       特效执行层（占位）
│  └─ save.js          双存档：game_save + meta_save（占位）
├─ data/
│  ├─ script.json      全部剧情节点 + schema 自述（含 scene 字段）
│  ├─ endings.json     5 个结局 + 路由表
│  └─ meta.json        跨周目：标题变化、第二周目解锁、变体文本
├─ assets/             留给后续音频（当前为空）
└─ docs/               需求、机制、大纲、分支结构、场景规范（本项目的纸面）
```

## 本地跑起来（三种方式，按推荐排序）

**① 本地服务器（推荐，最稳）**
```powershell
cd "C:\Users\user\Doubao\chats\2026-11-16\new-chat-1\rewind"
python -m http.server 8000
```
打开 <http://localhost:8000/index.html> → 点"自检"→ 应显示 **剧本节点数：2**。

想看场景主题：打开 <http://localhost:8000/preview.html>，底部七个按钮可一键切换场景。

**② VS Code Live Server**：右键 `index.html` → Open with Live Server。

**③ 直接双击 `index.html`**
页面能开，但点自检会报 CORS 错——**这是预期行为**，不是 Bug。浏览器禁止 `file://` 页面读取本地 JSON。
（如果将来一定要双击可用，阶段五可以生成一份 `data/bundle.js`，把 JSON 包成 `window.__SCRIPT__`。）

## 推送到 GitHub（首次）

```powershell
cd "C:\Users\user\Doubao\chats\2026-11-16\new-chat-1\rewind"
git init -b main
git add .
git commit -m "chore: 初始化工程骨架（阶段四）"
git remote add origin https://github.com/<你的用户名>/rewind.git
git push -u origin main
```

仓库先在 GitHub 网页上新建（**不要勾选** Add README / .gitignore / license，否则 push 会冲突）。

## 数据结构速查

节点字段见 `data/script.json` 的 `_schema`。三条最容易写错的规则：

1. `kind` 分三种：`story` 纯推进 / `action` 会被 `deviation` 吃掉 / `branch` 决定结局。
   **`branch` 永不允许被 deviation 命中** —— 否则整场游戏的选择都会被视为假的。
2. `deviation.once: true` 必须写。同一个错位发生第二次，就从恐怖变成 Bug。
3. `meta.json` 只读不写回：它是 `meta_save` 的规则表，不是玩家存档。

## 文档

| 文件 | 内容 |
|---|---|
| `docs/游戏核心需求文档.md` | 三层失控感、单场景、明确不做什么 |
| `docs/阶段二_玩法机制提案.md` | 竞品盘点 + 三种候选机制 |
| `docs/阶段三_故事大纲_v2.md` | 六幕节点、七个桥段、文字特效规范 |
| `docs/阶段三_分支结构与结局设计_v3.md` | 4 个真分支点、5 个结局、路由表 |

## 路线

- [x] 阶段一 需求确认
- [x] 阶段二 机制选定（B 骨架 + A 皮肤 + C 最后一刀）
- [x] 阶段三 大纲与分支
- [x] 阶段四 仓库骨架
- [ ] 阶段五 引擎 + 序章
- [ ] 阶段六 测试与版本更新
