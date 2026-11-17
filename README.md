# 请勿倒带 / Rewind

一盘没有标签的 90 年代录像带。纯文字微恐网页游戏，无框架、无构建工具。

> 状态：**阶段五第二轮进行中**。剧本已整篇换成新四章版（旧六幕归档在 `docs/archive/`）。
> **第一章（24 节点）已接上新引擎并实测通过**；第二至四章与五个结局节点待接入。
> 打开 `index.html` 就是游戏本体；`check.html` 是数据自检页；`preview.html` 是场景配色预览页。

## 目录结构

```
rewind/
├─ index.html          游戏本体（标题页 → 章节 → 结局 → 收集页）
├─ check.html          数据自检页：四份 JSON + 所有跳转/线索引用是否成立
├─ preview.html        场景主题预览页：九个场景一键切换（键盘 0–8）
├─ css/
│  ├─ base.css         骨架：底色/字体/HUD/正文/选项（颜色全部走 CSS 变量）
│  ├─ scenes.css       九套场景主题（s0–s8）+ 雪花擦除切换
│  ├─ effects.css      七种文字特效：血/抖/吃/打字/闪/码/扫描
│  └─ game.css         界面层：标题页/说话人/结局卡/收集页/线索笔记本/限时条
├─ js/
│  ├─ engine.js        通用引擎 v0.9：加载、渲染、条件、路由、线索、紧张度、限时、结局
│  ├─ effects.js       特效执行层：打字机/血/抖/吃/闪/时间码
│  └─ save.js          双存档：game_save + meta_save
├─ data/
│  ├─ script.json      剧情节点（当前：第一章 24 节点）+ schema 自述
│  ├─ clues.json       20 条线索 id → 中文描述（笔记本用）
│  ├─ endings.json     E1–E5 的名字与收集页文案（判定在各节点里）
│  └─ meta.json        跨周目：标题阶段、第二周目解锁、变体文本
├─ assets/             留给后续音频（当前为空）
├─ tools/
│  ├─ export_script_md.py    把 script.json 导出成好读的剧本 md
│  └─ export_script_acts.py  按章拆成可增补的工作稿
└─ docs/               需求、机制、大纲、分支、场景规范、剧本设计、引擎测试记录
```

## 本地跑起来（三种方式，按推荐排序）

**① 本地服务器（推荐，最稳）**
```powershell
cd "C:\Users\user\Doubao\chats\2026-11-16\new-chat-1\rewind"
python -m http.server 8230
```
打开 <http://localhost:8230/index.html> → 就是游戏。点「播放」开始；点正文可以把这一段的字直接铺完。

数据自检：<http://localhost:8230/check.html> → 应显示 **剧本节点数：24**、跳转与线索引用全部通过。
场景主题：<http://localhost:8230/preview.html>，底部九个按钮（或键盘 0–8）一键切换。

**② VS Code Live Server**：右键 `index.html` → Open with Live Server。

**③ 直接双击 `index.html`**
页面能开，但点播放会报 CORS 错——**这是预期行为**，不是 Bug。浏览器禁止 `file://` 页面读取本地 JSON。

## 推送到 GitHub

```powershell
cd "C:\Users\user\Doubao\chats\2026-11-16\new-chat-1\rewind"
& "D:\新建文件夹\Git\cmd\git.exe" add .
& "D:\新建文件夹\Git\cmd\git.exe" commit -m "feat: 第一章接新引擎"
& "D:\新建文件夹\Git\cmd\git.exe" push origin main
```

（本机 `git` 不在 PATH，所以上面写全路径。仓库为 Private。）

## 数据结构速查

节点字段见 `data/script.json` 的 `_schema`。五条最容易写错的规则：

1. **route 先跑，正文后打**。`route` 命中就跳走，本节点一个字都不显示——市场的"翻满三摊"、话题的"问满两个"都靠它。
2. **`requires` 不满足的选项不渲染，`grey: true` 的才渲染成灰**。用错哪一个，玩家就会看见他不该看见的选择。
3. **`lock` 是跨周目功能**，未解锁时不渲染；它来自 `meta.json` 的 `unlocks`，写进 `state.granted`。
4. **线索只进 `data/clues.json` 里的 id**，笔记本只显示中文描述，不显示总数。
5. **`meta.json` 只读不写回**：它是 `meta_save` 的规则表，不是玩家存档。

## 文档

| 文件 | 内容 |
|---|---|
| `docs/游戏核心需求文档.md` | 三层失控感、单场景、明确不做什么 |
| `docs/阶段二_玩法机制提案.md` | 竞品盘点 + 三种候选机制 |
| `docs/阶段三_故事大纲_v2.md` | 旧六幕大纲（已被新剧本取代，留作思路） |
| `docs/阶段三_分支结构与结局设计_v3.md` | 旧分支与结局设计（留作思路） |
| `docs/剧本设计_四章与五结局.md` | **新剧本设计：四章结构、flag 流转、结局优先级、UI 纪律** |
| `docs/阶段四_仓库结构与上线流程.md` | 跑法、推送、commit 规范、已知取舍 |
| `docs/阶段四补充_场景主题与切换规范.md` | 五条视觉语言、九场景配色、切换时序（上限 ≤20） |
| `docs/剧本_全篇.md` | 剧本的人读版（自动导出，勿手改） |
| `docs/剧本_分幕_工作稿.md` | 按章拆开的增补工作稿（自动导出） |
| `docs/阶段五_引擎实现与测试.md` | 引擎判定顺序、v0.9 扩展、第一章实测记录 |
| `docs/archive/` | 旧六幕：剧本 JSON、剧本全篇、分幕工作稿（只读） |

## 路线

- [x] 阶段一 需求确认
- [x] 阶段二 机制选定（B 骨架 + A 皮肤 + C 最后一刀）
- [x] 阶段三 大纲与分支
- [x] 阶段四 仓库骨架
- [x] 阶段五（旧六幕）：引擎 + 全篇剧本接通，五结局可达
- [x] 阶段五（新剧本）：引擎扩展到 v0.9（线索本 / 紧张度 / 探索次数 / 路由 / 限时 / 灰显）+ 第一章落地实测
- [ ] 第二至四章 + E1–E5 接入
- [ ] 阶段六 测试与版本更新（分支策略、commit 规范）
