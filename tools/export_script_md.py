"""把 data/script.json 导出成人类可读的剧本文档。改剧本只改 JSON，然后跑这个脚本。

用法：
    python tools/export_script_md.py
输出：
    docs/剧本_全篇.md
"""

import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "script.json"
ENDINGS = ROOT / "data" / "endings.json"
OUT = ROOT / "docs" / "剧本_全篇.md"

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

FX_NAME = {
    "type": "打字",
    "blood": "血字",
    "shake": "抖动",
    "eaten": "吃掉",
    "flash": "雪花闪",
}


def text_of(item):
    """text 里的一行，可能是字符串，也可能是条件文本或段内换人。"""
    if isinstance(item, str):
        return item
    if item.get("speaker"):
        cond = f"〔条件：{' 且 '.join(item['if'])}〕" if item.get("if") else ""
        return f"**{item['speaker']}**：{item.get('say', '')}{cond}"
    cond = f"〔条件：{' 且 '.join(item['if'])}〕" if item.get("if") else "〔条件〕"
    return f"{item.get('say', '')}{cond}"


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    ends = json.loads(ENDINGS.read_text(encoding="utf-8"))
    nodes = data["nodes"]

    total_chars = sum(len(text_of(t)) for n in nodes for t in n.get("text", []))

    lines = []
    lines.append(f"# {data['title']} · 全篇剧本")
    lines.append("")
    lines.append("> 本文件由 `tools/export_script_md.py` 从 `data/script.json` 生成，**不要手改**。")
    lines.append(f"> 节点 {len(nodes)} 个 · 正文约 {total_chars} 字 · 版本 {data['version']}")
    lines.append("> 旧六幕版本已归档在 `docs/archive/script_v1_六幕.json`，只作对照，不再改动。")
    lines.append("")

    lines.append("## 结局一览（来自 endings.json）")
    lines.append("")
    lines.append("| 结局 | 名字 | 收尾提示 |")
    lines.append("|---|---|---|")
    for e in ends.get("endings", []):
        lines.append(f"| {e['id']} | 《{e['title']}》 | {e.get('hint', '')} |")
    lines.append("")

    current_act = None
    for n in nodes:
        act = n.get("act", "")
        if act != current_act:
            current_act = act
            lines.append("")
            lines.append(f"## {act}")
            lines.append("")

        scene = n.get("scene", "")
        head = f"### `{n['id']}`　{SCENE_NAME.get(scene, scene)}"
        if n.get("speaker"):
            head += f"　／　{n['speaker']}"
        if n.get("code"):
            head += f"　`{n['code']}`"
        lines.append(head)
        lines.append("")

        # 副作用（进入节点时发生的）
        meta_bits = []
        if n.get("set"):
            meta_bits.append("set `" + "`, `".join(n["set"]) + "`")
        if n.get("clue"):
            meta_bits.append("线索 `" + "`, `".join(n["clue"]) + "`")
        if n.get("tension"):
            meta_bits.append(f"紧张度 {n['tension']:+d}")
        if n.get("spend"):
            meta_bits.append("计数 " + "、".join(f"{k}{v:+d}" for k, v in n["spend"].items()))
        if n.get("route"):
            meta_bits.append("路由 " + "；".join(f"[{' 且 '.join(r['when'])}]→`{r['next']}`" for r in n["route"]))
        if meta_bits:
            lines.append("**进入时**：" + "　·　".join(meta_bits))
            lines.append("")

        for t in n.get("text", []):
            lines.append(text_of(t))
            lines.append("")

        fx = n.get("effect") or []
        if isinstance(fx, str):
            fx = [fx]
        fx = [f for f in fx if f != "none"]
        if fx:
            lines.append(f"*特效：{'、'.join(FX_NAME.get(f, f) for f in fx)}*")
            lines.append("")

        if n.get("ending"):
            lines.append(f"**结局 {n['ending']}** 收尾句：{n.get('end_text', '')}")
            if n.get("end_note"):
                lines.append(f"　左下角小字：{n['end_note']}")
            lines.append("")
            continue

        for c in n.get("choices", []):
            mark = ""
            if c.get("requires"):
                mark += f"　〔需 {' 且 '.join(c['requires'])}"
                mark += "，灰显〕" if c.get("grey") else "〕"
            if c.get("lock"):
                mark += f"　〔跨周目 `{c['lock']}`〕"
            if c.get("label_effect"):
                mark += f"　〔文字特效 {c['label_effect']}〕"
            if c.get("time_limit"):
                mark += f"　〔限时 {c['time_limit']}s → `{c.get('timeout')}`〕"
            lines.append(f"- → **{c['label']}**　`{c['next']}`{mark}")
        lines.append("")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"written: {OUT}  ({total_chars} chars, {len(nodes)} nodes)")


if __name__ == "__main__":
    main()
