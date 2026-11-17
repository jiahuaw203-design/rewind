"""把 data/script.json 拆成"分幕工作稿"，供人工在文档里补写。

用法：
    python tools/export_script_acts.py
输出：
    docs/剧本_分幕_工作稿.md
"""

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "script.json"
ENDINGS = ROOT / "data" / "endings.json"
OUT = ROOT / "docs" / "剧本_分幕_工作稿.md"

SCENE_NAME = {
    "s0": "楼道",
    "s1": "阿磊的客厅",
    "s2": "带子画面",
    "s3": "厨房",
    "s4": "空客厅",
    "s5": "结局客厅",
    "s6": "白屏",
    "s7": "旧货市场",
    "s8": "小饭馆",
}

ACT_BLURB = {
    "第一章": ("到访 → 旧货市场 → 饭馆 → 回去", "铺两件事：这屋子暖得过头；阿磊一直在替别人做小事（垫纸巾）。市场里限翻三个摊，空带靠运气，也靠阿磊兜底。"),
    "第二章": ("五个探索点 × 三次机会", "不显示剩余次数，用环境声提示：喊价 → 收摊 → 巷口有人说话 → 单元门 → 脚步声。播放录像额外再耗两次。"),
    "第三章": ("录像机自己响了", "按播放 / 按倒带 / 关电视。倒带只退一秒，这一秒就是后面所有判定的钥匙。"),
    "第四章": ("阿磊站在面前，手里没刀", "坐下 / 站着 / 先开口。灰显台词表是「你查到多少」的可视化。核心抉择五秒限时。"),
    "结局": ("E1–E5", "先命中先返回：E5 ＞ E3 ＞ E4 ＞ E2 ＞ E1。"),
}

FX_NAME = {
    "type": "打字",
    "blood": "血字",
    "shake": "抖动",
    "eaten": "吃掉",
    "flash": "雪花闪",
}


def text_of(item):
    if isinstance(item, str):
        return item
    if item.get("speaker"):
        return f"**{item['speaker']}**：{item.get('say', '')}"
    cond = f"〔仅当 {' 且 '.join(item['if'])}〕" if item.get("if") else "〔条件〕"
    return f"{item.get('say', '')}　{cond}"


def choice_line(c):
    marks = []
    if c.get("requires"):
        marks.append("需 " + " 且 ".join(c["requires"]) + ("（灰显）" if c.get("grey") else ""))
    if c.get("lock"):
        marks.append(f"跨周目 `{c['lock']}`")
    if c.get("label_effect"):
        marks.append(f"选项文字特效 `{c['label_effect']}`")
    if c.get("time_limit"):
        marks.append(f"限时 {c['time_limit']}s → `{c.get('timeout')}`")
    tail = f"　（{' · '.join(marks)}）" if marks else ""
    return f"- **{c['label']}** → `{c['next']}`{tail}"


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    ends = json.loads(ENDINGS.read_text(encoding="utf-8"))
    nodes = data["nodes"]

    total_chars = sum(len(text_of(t)) for n in nodes for t in n.get("text", []))
    out = []
    out.append(f"# {data['title']} · 分幕剧本工作稿")
    out.append("")
    out.append("> 给编剧用的一版：**每章单独成章，节点带 id 与跳转**，方便直接在上面增删。")
    out.append("> 本稿由 `tools/export_script_acts.py` 从 `data/script.json` 生成；改完正文后把改动回填进 JSON，再重新出一遍。")
    out.append("> 旧六幕工作稿已归档在 `docs/archive/剧本_分幕_工作稿_v1_六幕.md`。")
    out.append(f"> 现状：{len(nodes)} 个节点 · 正文约 {total_chars} 字。")
    out.append("")

    out.append("## 结局一览")
    out.append("")
    out.append("| 结局 | 名字 | 位置 | 收尾提示 |")
    out.append("|---|---|---|---|")
    for e in ends.get("endings", []):
        out.append(f"| {e['id']} | 《{e['title']}》 | {e.get('slot', '')} | {e.get('hint', '')} |")
    out.append("")
    out.append("结局判定（从高到低，先命中先返回）：")
    out.append("")
    out.append("1. **E5**：`watched_dog_tape` 且 `checked_dog_bed` 且 `petted_dog`，且在 CH4_CALL")
    out.append("2. **E3**：`timecode_anomaly` 且 `clues>=3` 且 `stall_unlocked`，且在 CH4_SEE")
    out.append("3. **E4**：`checked_door`，且在 CH4_RUN")
    out.append("4. **E2**：CH4_SEE 不满足 E3 / CH4_RUN 无 `checked_door`")
    out.append("5. **E1**：超时且 `clues<3` / 选「回头看他」/ 无时间码却「回头」")
    out.append("")

    current_act = None
    act_nodes = []

    def flush_act(act):
        if not act:
            return
        chars = sum(len(text_of(t)) for n in act_nodes for t in n.get("text", []))
        scenes = []
        for n in act_nodes:
            s = n.get("scene")
            if s and s not in scenes:
                scenes.append(s)
        out.append("")
        out.append(f"**本章统计**：{len(act_nodes)} 个节点 · {chars} 字 · 场景 {' → '.join(SCENE_NAME.get(s, s) for s in scenes)}")
        out.append("")
        out.append("**本章补充位（这里留白，直接在这儿写）**")
        out.append("")
        out.append("- 想加的环境细节：")
        out.append("- 想加的人物动作/对话：")
        out.append("- 想加的桥段（细思极恐那种）：")
        out.append("")

    for n in nodes:
        act = n.get("act", "")
        if act != current_act:
            flush_act(current_act)
            current_act = act
            act_nodes = []
            title, blurb = ACT_BLURB.get(act, (act, ""))
            out.append("")
            out.append(f"## {act} · {title}")
            out.append("")
            out.append(f"> {blurb}")
            out.append("")
        act_nodes.append(n)

        scene = n.get("scene", "")
        head = f"### `{n['id']}`　{SCENE_NAME.get(scene, scene)}"
        if n.get("speaker"):
            head += f"　／　**{n['speaker']}**"
        if n.get("code"):
            head += f"　`{n['code']}`"
        out.append(head)
        out.append("")

        fx = n.get("effect") or []
        if isinstance(fx, str):
            fx = [fx]
        fx = [f for f in fx if f != "none"]
        if fx:
            out.append(f"*特效：{'、'.join(FX_NAME.get(f, f) for f in fx)}*")
            out.append("")

        for t in n.get("text", []):
            out.append(text_of(t))
            out.append("")

        if n.get("ending"):
            out.append(f"**结局 {n['ending']}**　收尾句：**{n.get('end_text', '')}**")
            if n.get("end_note"):
                out.append(f"　（左下角小字：{n['end_note']}）")
            out.append("")
            continue

        if n.get("choices"):
            out.append("**选项**")
            out.append("")
            for c in n["choices"]:
                out.append(choice_line(c))
            out.append("")

        if n.get("route"):
            out.append("> 进入即判定：" + "；".join(f"[{' 且 '.join(r['when'])}] → `{r['next']}`" for r in n["route"]))
            out.append("")

    flush_act(current_act)

    out.append("")
    out.append("## 改剧本的三种标法（怎么写都行，我按这个回填）")
    out.append("")
    out.append("1. **在原段后面加**：直接在节点下面写几行，我插进该节点的 `text`。")
    out.append("2. **加新节点**：写个临时名字（如 `CH2_A_DEEP_b`），标清它在谁后面、通向谁，我来接线。")
    out.append("3. **删或合并**：直接说“这几句不要了/这两段合并”，我重算字数与场景切换。")
    out.append("")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(out), encoding="utf-8", newline="\n")
    print(f"written: {OUT}  ({total_chars} chars, {len(nodes)} nodes)")


if __name__ == "__main__":
    main()
