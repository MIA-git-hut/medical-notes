# -*- coding: utf-8 -*-
"""质检四大经典生成页面：

1. 原文逐行核对：manifest 源文（经 fix_text 规范化后）每一非空行都出现在对应页面的引用块中；
2. 残留字符扫描：异体/讹字未替换净尽、非 BMP 冷僻字、底本标记（==、{|、::、Category:、*…）等；
3. 占位注释计数：每页「学习要点」1 处；有讲稿者「解说」再 1 处。

用法: python tools/four-classics/qc_classics_pages.py
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
import gen_classics_pages as G
from norm_text import NL, REPL_MULTI, REPL_ONE, fix_text

ROOT = G.ROOT
DOCS = G.DOCS

# 允许保留的非 BMP 字（灵枢·骨度「𩩲骬」）
ALLOW_NONBMP = set("𩩲骬")

# 已成稿的人工校订页：不按骨架页标准核对
CURATED = {
    os.path.join(DOCS, "黄帝内经", "001-上古天真论.md"),
    os.path.join(DOCS, "伤寒论", "05-辨太阳病脉证并治（上）第五.md"),
    os.path.join(DOCS, "金匮要略", "01-脏腑经络先后病脉证第一.md"),
}

RESIDUE_ASCII = ["==", "{|", "|}", "::", "Category:", "素问•"]
RESIDUE_CHARS = [a for a, _ in REPL_MULTI + REPL_ONE if a not in ("　",)]


def page_path(book, u):
    num, name = int(u["num"]), u["name"]
    if book == "素问":
        return os.path.join(DOCS, "黄帝内经", f"{num:03d}-{name}.md")
    if book == "灵枢":
        return os.path.join(DOCS, "黄帝内经", f"{num + 81:03d}-{name}.md")
    if book == "伤寒论":
        return os.path.join(DOCS, "伤寒论", f"{num:02d}-{name}.md")
    return os.path.join(DOCS, "金匮要略", f"{num:02d}-{name}.md")


def want_yuanwen_line(line):
    if line.startswith("【") and line.endswith("】"):
        return "> **" + line.strip("【】").strip() + "**"
    return "> " + line


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    man = json.load(open(G.SRC, encoding="utf-8"))
    problems = []
    checked = 0
    n_note = 0
    filled = 0

    for book in ("素问", "灵枢", "伤寒论", "金匮要略"):
        for u in man[book]:
            path = page_path(book, u)
            if not os.path.exists(path):
                problems.append(("缺失页面", path, ""))
                continue
            if path in CURATED:
                continue
            page = open(path, encoding="utf-8").read()
            checked += 1

            # 占位计数：0=已填写；骨架页应为 1（无解说）或 2（有解说）
            n = page.count("<!-- 待补")
            has_jieshuo = "## 倪海厦《人纪》解说" in page
            want = 2 if has_jieshuo else 1
            if n == 0:
                filled += 1
            elif n != want:
                problems.append(("占位注释数", path, f"期望 {want}，实为 {n}"))
            n_note += 1

            # 原文逐行核对
            text = fix_text(u["text"], book, u["name"])
            for line in text.split(NL):
                line = line.strip()
                if not line:
                    continue
                if want_yuanwen_line(line) not in page:
                    problems.append(("原文缺行", path, line[:40]))
                    if len(problems) > 200:
                        break

            # 残留字符（只管原文引用行；小注中述及底本字形属有意保留）
            quoted = NL.join(l for l in page.split(NL) if l.startswith(">"))
            for a in RESIDUE_CHARS:
                if a in quoted:
                    problems.append(("残留字形", path, a))
            for a in RESIDUE_ASCII:
                if a in quoted:
                    problems.append(("残留标记", path, a))
            for ch in page:
                if ord(ch) > 0xFFFF and ch not in ALLOW_NONBMP:
                    problems.append(("非BMP字", path, ch))

    # 伤寒论序页单独核
    pre = os.path.join(DOCS, "伤寒论", "00-序.md")
    if os.path.exists(pre):
        page = open(pre, encoding="utf-8").read()
        checked += 1
        for u in man["伤寒论序"]:
            for line in fix_text(u["text"], "伤寒论", "伤寒论序").split(NL):
                line = line.strip()
                if line and want_yuanwen_line(line) not in page:
                    problems.append(("序文缺行", pre, line[:40]))
        n_note += 1

    print(f"核对页面: {checked}，其中已填写（无占位）: {filled}")
    print(f"问题: {len(problems)}")
    for kind, path, detail in problems[:120]:
        print(f"  [{kind}] {os.path.basename(path)} :: {detail}")
    if len(problems) > 120:
        print(f"  …另 {len(problems) - 120} 条")


if __name__ == "__main__":
    main()
