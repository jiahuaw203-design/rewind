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
OUT = ROOT / "docs" / "剧本_分幕_工作稿.md"

SCENE_NAME = {
    "s0": "楼道",
    "s1": "客厅",
    "s2": "带子画面",
    "s3": "厨房",
    "s4": "空客厅",
    "s5": "结局客厅",
    "s6": "白屏",
}

ACT_BLURB = {
    "幕一": ("门口 → 客厅", "把“暖”和“不对劲”同时铺下去：风扇、挂历、塑料桌布、猫狗、雪花电视。阿磊说一会儿去吃饭。"),
    "幕二": ("第一轮播放：一盘空带", "带子什么都没录，可它有时间码、有呼吸。快进闪一下背影；倒回去，雪花里有拖鞋声。"),
    "幕三": ("第二轮播放：狗", "吃饭回来，狗没了。阿磊说“好奇怪啊”，然后想喝啤酒。带子里是狗走进厨房、门关上。"),
    "幕四": ("第三轮播放：狗和猫", "猫也没了。带子卡在机器里。画面只是往前推，推厨房那扇门。身后一直有脚步声。"),
    "幕五": ("洗澡 → 空客厅", "洗完出来，客厅空了。三罐啤酒，一罐开了没喝。厨房刀架上少了一把刀。"),
    "幕六": ("第四轮播放：阿磊、狗、猫", "时间码 00:07:20。按倒带，它前进一秒。厨房里阿磊剁肉。他一回头。"),
    "结局": ("五个结局", "E0 没吃成 / E1 看完 / E2 剪辑 / E3 带走 / E4 玻璃"),
}

KIND_MARK = {
    "story": "推进",
    "action": "行动（可被错位命中）",
    "branch": "分支（决定结局，永不被错位）",
}

FX_NAME = {
    "type": "打字",
    "blood": "血字",
    "shake": "抖动",
    "eaten": "吃掉",
    "flash": "雪花闪",
}


def choice_line(c):
    marks = [KIND_MARK.get(c.get("kind"), "推进")]
    if c.get("lock"):
        marks.append(f"需 flag `{c['lock']}`")
    if c.get("label_effect"):
        marks.append(f"选项文字特效 `{c['label_effect']}`")
    if c.get("silent"):
        marks.append("点了没反应")
    return f"- **{c['label']}** → `{c['next']}`　（{' · '.join(marks)}）"


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    nodes = data["nodes"]

    total_chars = sum(len(t) for n in nodes for t in n.get("text", []))
    out = []
    out.append(f"# {data['title']} · 分幕剧本工作稿")
    out.append("")
    out.append("> 给编剧用的一版：**每幕单独成章，节点带 id 与跳转**，方便直接在上面增删。")
    out.append("> 本稿由 `tools/export_script_acts.py` 从 `data/script.json` 生成；改完正文后我会把改动回填进 JSON，再重新出一遍。")
    out.append(f"> 现状：{len(nodes)} 个节点 · 正文 {total_chars} 字 · 按幕统计见每章开头。")
    out.append("")

    # 全局速览
    out.append("## 速览：五条路线与五个结局")
    out.append("")
    endings = {
        "E0": ("没吃成", "`a2_07` 选「还是算了」", "下一顿，我等你。"),
        "E1": ("看完", "终局 `a6_12` 选「站着不动」", "这盘带子没有标签。"),
        "E2": ("剪辑", "终局 `a6_12` 选「往门口跑」", "门在这里，从来不是用来出去的。"),
        "E3": ("带走", "`a5_02b` 选「用力拔出来，装进包里」（需 `tape_stuck`）", "你怎么才回来。"),
        "E4": ("玻璃", "终局 `a6_12` 选「先把电视关掉」（需第二周目）", "原来我一直在玻璃里面。"),
    }
    out.append("| 结局 | 名字 | 入口 | 收尾句 |")
    out.append("|---|---|---|---|")
    for k, (name, how, last) in endings.items():
        out.append(f"| {k} | {name} | {how} | {last} |")
    out.append("")
    out.append("三条硬规则（改剧本时不能破）：")
    out.append("")
    out.append("1. 被录进带子的东西，会从房间里消失（带子收纳现实）。")
    out.append("2. 先有带子，后有这一晚（带子永远比现实早一轮）。")
    out.append("3. 带子只有一个空位，第四段留给镜头后面的人，也就是“我”。")
    out.append("")

    current_act = None
    act_nodes = []

    def flush_act(act):
        if not act:
            return
        chars = sum(len(t) for n in act_nodes for t in n.get("text", []))
        scenes = []
        for n in act_nodes:
            s = n.get("scene")
            if s and s not in scenes:
                scenes.append(s)
        out.append("")
        out.append(f"**本章统计**：{len(act_nodes)} 个节点 · {chars} 字 · 场景 {' → '.join(SCENE_NAME.get(s, s) for s in scenes)}")
        out.append("")
        out.append("**本幕补充位（这里留白，直接在这儿写）**")
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
            out.append(t)
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

        if n.get("deviation"):
            dv = n["deviation"]
            out.append(f"> ⚠ 错位（{dv['mode']}，只此一次）：本节点里 `action` 类的选项会被引擎改写成 `{dv['target']}`。")
            out.append("")

    flush_act(current_act)

    out.append("")
    out.append("## 改剧本的三种标法（你怎么写都行，我按这个回填）")
    out.append("")
    out.append("1. **在原段后面加**：直接在节点下面写几行，我插进该节点的 `text`。")
    out.append("2. **加新节点**：写个临时名字（如 `a3_08b`），标清它在谁后面、通向谁，我来接线。")
    out.append("3. **删或合并**：直接说“这几句不要了/这两段合并”，我重算字数与场景切换。")
    out.append("")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(out), encoding="utf-8", newline="\n")
    print(f"written: {OUT}  ({total_chars} chars, {len(nodes)} nodes)")


if __name__ == "__main__":
    main()
