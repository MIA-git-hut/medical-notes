# -*- coding: utf-8 -*-
"""生成四大经典骨架页面：素问 81 篇、灵枢 81 篇、伤寒论（序 + 22 篇）、金匮要略 25 篇。

原文照录 data/四大经典/源文/manifest.json，仅经 norm_text 规范化底本异体/讹字；
「学习要点」「倪海厦《人纪》解说」以 HTML 注释占位（不渲染、不外显），由后续工序填写。

用法: python tools/four-classics/gen_classics_pages.py [--report] [--force]
--force 只重建仍带「<!-- 待补」占位的骨架页；已成稿（无占位）与人工校订页面一概跳过。
"""
import glob
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
if HERE not in sys.path:
    sys.path.insert(0, HERE)
from norm_text import NL, EXTRAS, fix_text

ROOT = r"D:\medical-notes"
SRC = os.path.join(ROOT, "data", "四大经典", "源文", "manifest.json")
SLICE = os.path.join(ROOT, "data", "四大经典", "讲稿")
DOCS = os.path.join(ROOT, "docs", "四大经典")

D = "零一二三四五六七八九"
CNCH = "一二三四五六七八九十"


def cn(n):
    if n < 10:
        return D[n]
    if n < 20:
        return "十" + (D[n - 10] if n > 10 else "")
    if n < 100:
        t, r = divmod(n, 10)
        return D[t] + "十" + (D[r] if r else "")
    h, r = divmod(n, 100)
    s = D[h] + "百"
    if r == 0:
        return s
    if r < 10:
        return s + "零" + D[r]
    return s + cn(r)


def strip_ordinal(name):
    """「辨脉法第一」→「辨脉法」；「辨太阳病脉证并治（上）第五」→「……（上）」。"""
    i = len(name)
    while i > 0 and name[i - 1] in CNCH:
        i -= 1
    if 1 <= i < len(name) and name[i - 1] == "第":
        return name[:i - 1]
    return name


def render_yuanwen(text):
    """原文分行照录：源文每行独立成段；「【方名】」行作粗体；连续「|」行并入一表。"""
    blocks = []
    for p in text.split(NL + NL):
        lines = [x.strip() for x in p.split(NL) if x.strip()]
        tbl = []
        for x in lines:
            if x.startswith("|"):
                tbl.append(x)
                continue
            if tbl:
                blocks.append(tbl)
                tbl = []
            if x.startswith("【") and x.endswith("】"):
                blocks.append(["**" + x.strip("【】").strip() + "**"])
            else:
                blocks.append(x)
        if tbl:
            blocks.append(tbl)
    L = []
    for b in blocks:
        if isinstance(b, list):
            L += ["> " + r for r in b]
        else:
            L.append("> " + b)
        L.append("")
    if L:
        L.pop()
    return L


def front(title, cat, tags):
    return ["---", "title: " + title, "分类: " + cat,
            "tags: [" + ", ".join(tags) + "]", "---", ""]


def head(h1, note):
    return ["# " + h1, "", "> [!note] " + note, ""]


def study_points():
    return ["## 学习要点", "",
            "<!-- 待补：按「十五五」规划教材教学要求，写 掌握／熟悉／了解 分级的要点（3–6 条） -->", ""]


def jieshuo(hint):
    return ["## 倪海厦《人纪》解说", "",
            "<!-- 待补：据 " + hint + " 撰写；先删本注释再落笔 -->", ""]


def xiaozhu(book, name, bullets):
    ex = EXTRAS.get((book, name))
    if ex:
        bullets = bullets + [ex]
    return ["## 版本与文字小注", ""] + ["- " + b for b in bullets] + [""]


def exists_slice(sub, pat):
    g = glob.glob(os.path.join(SLICE, sub, pat))
    return sorted(g)[0] if g else None


def suwen_page(u, sl):
    num, name = int(u["num"]), u["name"]
    tags = ["黄帝内经", "素问"] + (["倪海厦"] if sl else [])
    note = ("本页为《黄帝内经·素问》第 " + str(num) + " 篇。原文以通行《黄帝内经素问》"
            "（王冰次注本系统）文字为底本，转写为简体；学习要点按「十五五」规划教材"
            "《内经选读》教学要求整理")
    note += "；解说要点摘编自倪海厦《人纪·黄帝内经》讲座。" if sl else \
            "。倪海厦《人纪·黄帝内经》讲座未及本篇，本页不设解说。"
    L = front(name, "黄帝内经", tags)
    L += head("第" + cn(num) + "章 " + name, note)
    L += study_points()
    L += ["## 原文", ""] + render_yuanwen(fix_text(u["text"], "素问", name)) + [""]
    if sl:
        rel = os.path.relpath(sl, ROOT).replace(os.sep, "/")
        L += jieshuo(rel)
    L += xiaozhu("素问", name,
                 ["原文据通行《黄帝内经素问》（王冰次注本系统）文字转写简体，各本句读、用字略有出入。"])
    return NL.join(L)


def lingshu_page(u):
    num, name = int(u["num"]), u["name"]
    idx = num + 81
    note = ("本页为《黄帝内经·灵枢》第 " + str(num) + " 篇（页序承素问接排，"
            "为《黄帝内经》第 " + str(idx) + " 章）。原文据通行《灵枢经》文字转写简体；"
            "学习要点按「十五五」规划教材《内经选读》教学要求整理。"
            "倪海厦《人纪》讲座未系统讲授《灵枢》，本页不设解说，"
            "可与《人纪·针灸》教程及经络腧穴相关笔记互参。")
    L = front(name, "黄帝内经", ["黄帝内经", "灵枢"])
    L += head("第" + cn(idx) + "章 " + name, note)
    L += study_points()
    L += ["## 原文", ""] + render_yuanwen(fix_text(u["text"], "灵枢", name)) + [""]
    L += xiaozhu("灵枢", name,
                 ["原文据通行《灵枢经》文字转写简体，各本句读、用字略有出入。"])
    return NL.join(L)


SHANGHAN_SLICE = {
    5: "data/四大经典/讲稿/伤寒论/太阳/",
    6: "data/四大经典/讲稿/伤寒论/太阳/",
    7: "data/四大经典/讲稿/伤寒论/太阳/",
    8: "data/四大经典/讲稿/伤寒论/13-阳明.md",
    9: "data/四大经典/讲稿/伤寒论/13-少阳.md",
    11: "data/四大经典/讲稿/伤寒论/13-补遗.md",
    13: "data/四大经典/讲稿/伤寒论/05-续伤寒篇-霍乱等.md",
    14: "data/四大经典/讲稿/伤寒论/04-阴阳易差后劳复.md",
}


def shanghan_page(u):
    num, name0 = int(u["num"]), u["name"]
    name = strip_ordinal(name0)
    sl = SHANGHAN_SLICE.get(num)
    tags = ["伤寒论"] + (["倪海厦"] if sl else [])
    note = ("本页为《伤寒论》第 " + str(num) + " 篇（" + str(u.get("juan") or "") + "）。"
            "原文据宋本（明·赵开美复刻宋本）文字转写简体")
    note += "；解说要点摘编自倪海厦《人纪·伤寒论》讲座。" if sl else \
            "；本篇讲座讲稿暂未收得，解说从略。"
    L = front(name0, "伤寒论", tags)
    L += head("第" + cn(num) + "章 " + name, note)
    L += study_points()
    L += ["## 原文", ""] + render_yuanwen(fix_text(u["text"], "伤寒论", name0)) + [""]
    if sl:
        L += jieshuo(sl)
    L += xiaozhu("伤寒论", name0,
                 ["原文据宋本（明·赵开美复刻宋本）系统文字转写简体；条文序号、篇次与教材或有出入。"])
    return NL.join(L)


def jingui_page(u, sl):
    num, name = int(u["num"]), u["name"]
    tags = ["金匮要略"] + (["倪海厦"] if sl else [])
    note = ("本页为《金匮要略》第 " + str(num) + " 篇。原文据宋本（明·赵开美复刻宋本）"
            "文字转写简体")
    note += "；解说要点摘编自倪海厦《人纪·金匮要略》讲座。" if sl else \
            "；本篇讲座讲稿暂未收得，解说从略。"
    L = front(name, "金匮要略", tags)
    L += head("第" + cn(num) + "章 " + name, note)
    L += study_points()
    L += ["## 原文", ""] + render_yuanwen(fix_text(u["text"], "金匮要略", name)) + [""]
    if sl:
        rel = os.path.relpath(sl, ROOT).replace(os.sep, "/")
        L += jieshuo(rel)
    L += xiaozhu("金匮要略", name,
                 ["原文据宋本（明·赵开美复刻宋本）系统文字转写简体，方后注、篇次与教材或有出入。"])
    return NL.join(L)


def shanghan_preface(units):
    L = front("伤寒论序", "伤寒论", ["伤寒论", "序", "张仲景", "倪海厦"])
    L += head("伤寒论序",
              "本页收录宋校《伤寒论》序（林亿等）与《伤寒论》自序（张仲景原序），"
              "序文为读《伤寒论》之入门。原文据宋本文字转写简体。")
    L += study_points()
    L += ["## 原文", ""]
    L += ["### 宋校《伤寒论》序（林亿等）", ""] + \
         render_yuanwen(fix_text(units[0]["text"], "伤寒论", "伤寒论序")) + [""]
    L += ["### 伤寒论序（张仲景原序）", ""] + \
         render_yuanwen(fix_text(units[1]["text"], "伤寒论", "伤寒论序")) + [""]
    L += jieshuo("data/四大经典/讲稿/伤寒论/（讲稿中与序文、张仲景学术源流相关的部分）")
    L += xiaozhu("伤寒论", "伤寒论序",
                 ["宋校序文字据宋本卷首，与《新校备急千金要方》所引略异。",
                  "张仲景原序「撰用《素问》《九卷》《八十一难》……」句，后世有考辨，教材多存其旧。"])
    return NL.join(L)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    man = json.load(open(SRC, encoding="utf-8"))
    force = "--force" in sys.argv
    report = "--report" in sys.argv
    stats = {"素问": 0, "灵枢": 0, "伤寒论": 0, "金匮要略": 0}
    skipped, protected, nojieshuo = [], [], []

    def emit(path, content, key, label):
        if os.path.exists(path):
            old = open(path, encoding="utf-8").read()
            if "<!-- 待补" not in old:
                protected.append(label)
                return
            if not force:
                skipped.append(label)
                return
        stats[key] += 1
        if report:
            return
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as fh:
            fh.write(content)

    # 素问 001-081、灵枢 082-162，同置于 黄帝内经/
    for u in man["素问"]:
        num, name = int(u["num"]), u["name"]
        sl = exists_slice("素问", f"{num:03d}-*.md")
        if not sl:
            nojieshuo.append("素问" + name)
        emit(os.path.join(DOCS, "黄帝内经", f"{num:03d}-{name}.md"),
             suwen_page(u, sl), "素问", f"黄帝内经/{num:03d}-{name}")
    for u in man["灵枢"]:
        num, name = int(u["num"]), u["name"]
        emit(os.path.join(DOCS, "黄帝内经", f"{num + 81:03d}-{name}.md"),
             lingshu_page(u), "灵枢", f"黄帝内经/{num + 81:03d}-{name}")

    # 伤寒论：00-序 + 01-22
    emit(os.path.join(DOCS, "伤寒论", "00-序.md"),
         shanghan_preface(man["伤寒论序"]), "伤寒论", "伤寒论/00-序")
    for u in man["伤寒论"]:
        num, name = int(u["num"]), u["name"]
        if num not in SHANGHAN_SLICE:
            nojieshuo.append("伤寒论" + name)
        emit(os.path.join(DOCS, "伤寒论", f"{num:02d}-{name}.md"),
             shanghan_page(u), "伤寒论", f"伤寒论/{num:02d}-{name}")

    # 金匮要略 01-25
    for u in man["金匮要略"]:
        num, name = int(u["num"]), u["name"]
        sl = exists_slice("金匮要略", f"{num:02d}-*.md")
        if not sl:
            nojieshuo.append("金匮要略" + name)
        emit(os.path.join(DOCS, "金匮要略", f"{num:02d}-{name}.md"),
             jingui_page(u, sl), "金匮要略", f"金匮要略/{num:02d}-{name}")

    print("生成统计:", stats)
    print("保留（已成稿/人工校订）:", len(protected), "→", "、".join(protected))
    print("跳过（已存在且占位未填）:", len(skipped), "→", "、".join(skipped))
    print("无解说（讲稿未及）:", len(nojieshuo))
    print("  ", "、".join(nojieshuo))


if __name__ == "__main__":
    main()
