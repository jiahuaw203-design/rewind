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
OUT = ROOT / "docs" / "剧本_全篇.md"

SCENE_NAME = {
    "s0": "楼道",
    "s1": "客厅",
    "s2": "带子画面",
    "s3": "厨房",
    "s4": "空客厅",
    "s5": "结局客厅",
    "s6": "白屏",
}


def main() -> None:
    data = json.loads(SRC.read_text(encoding="utf-8"))
    nodes = data["nodes"]

    lines = []
    total_chars = sum(len(t) for n in nodes for t in n.get("text", []))
    lines.append(f"# {data['title']} · 全篇剧本")
    lines.append("")
    lines.append("> 本文件由 `tools/export_script_md.py` 从 `data/script.json` 生成，**不要手改**。")
    lines.append(f"> 节点 {len(nodes)} 个 · 正文 {total_chars} 字 · 版本 {data['version']}")
    lines.append("")

    current_act = None
    for n in nodes:
        act = n.get("act", "")
        if act != current_act:
            current_act = act
            lines.append("")
            lines.append(f"## {act}")
            lines.append("")
            if act == "幕一":
                lines.append("> 门口 → 客厅。暖得过头的一间屋子。")
                lines.append("")
            elif act == "幕二":
                lines.append("> 第一轮播放：一盘空带。")
                lines.append("")
            elif act == "幕三":
                lines.append("> 第二轮播放：狗。")
                lines.append("")
            elif act == "幕四":
                lines.append("> 第三轮播放：狗和猫。")
                lines.append("")
            elif act == "幕五":
                lines.append("> 洗澡。回来以后，客厅空了。")
                lines.append("")
            elif act == "幕六":
                lines.append("> 第四轮播放：阿磊、狗、猫。")
                lines.append("")
            elif act == "结局":
                lines.append("> 五个结局。")
                lines.append("")

        scene = n.get("scene", "")
        head = f"### `{n['id']}`　{SCENE_NAME.get(scene, scene)}"
        if n.get("speaker"):
            head += f"　／　{n['speaker']}"
        if n.get("code"):
            head += f"　`{n['code']}`"
        lines.append(head)
        lines.append("")
        for t in n.get("text", []):
            lines.append(t)
            lines.append("")

        fx = n.get("effect") or []
        if isinstance(fx, str):
            fx = [fx]
        fx = [f for f in fx if f != "none"]
        if fx:
            lines.append(f"*特效：{'、'.join(fx)}*")
            lines.append("")

        if n.get("ending"):
            lines.append(f"**结局 {n['ending']}** 收尾句：{n.get('end_text', '')}")
            if n.get("end_note"):
                lines.append(f"　左下角小字：{n['end_note']}")
            lines.append("")
            continue

        for c in n.get("choices", []):
            kind = c.get("kind", "story")
            mark = ""
            if kind == "branch":
                mark = "　〔分支〕"
            elif kind == "action":
                mark = "　〔行动，可被错位吃掉〕"
            if c.get("lock"):
                mark += f"　〔需 {c['lock']}〕"
            if c.get("label_effect"):
                mark += f"　〔文字特效 {c['label_effect']}〕"
            if c.get("silent"):
                mark += "　〔点了没反应〕"
            lines.append(f"- → **{c['label']}**　`{c['next']}`{mark}")
        if n.get("deviation"):
            dv = n["deviation"]
            lines.append(
                f"- ⚠ 错位（{dv['mode']}）：本节点的行动选项会被改写成 `{dv['target']}`"
            )
        lines.append("")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines), encoding="utf-8", newline="\n")
    print(f"written: {OUT}  ({total_chars} chars, {len(nodes)} nodes)")


if __name__ == "__main__":
    main()
