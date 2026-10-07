# -*- coding: utf-8 -*-
"""把讲稿模块切分为按篇/按条文组的散件，便于页面写作时按需取用。

输入: data/四大经典/讲稿/modules/*.md
输出: data/四大经典/讲稿/素问/NNN-篇名.md        （08 模块，72 篇）
      data/四大经典/讲稿/金匮要略/NN-篇名.md      （04+05 模块，金匮 1-22 篇）
      data/四大经典/讲稿/伤寒论/太阳/NN-条文.md   （01 模块，太阳篇分组）
      data/四大经典/讲稿/伤寒论/13-阳明.md 等     （13 模块分经）
      data/四大经典/讲稿/伤寒论/02-诸经概说.md    （02 模块）
      data/四大经典/讲稿/伤寒论/index.tsv         （伤寒切片索引）
"""
import json
import os
import shutil
import re
import sys

import opencc

ROOT = r"D:\medical-notes"
J = os.path.join(ROOT, "data", "四大经典", "讲稿")
MOD = os.path.join(J, "modules")
_cc = opencc.OpenCC("t2s")

VARIANT = {
    "欬论": "咳论", "痺论": "痹论", "刺腰论痛": "刺腰痛", "刺腰痛": "刺腰痛",
    "藏气法时": "脏气法时", "玉机真藏": "玉机真脏", "五藏别论": "五脏别论",
    "五藏生成": "五脏生成", "宝命全角": "宝命全形", "宣明五气": "宣明五气",
    "阳明脉解": "阳明脉解", "血气形志": "血气形志", "离合真邪": "离合真邪",
    "太阴阳明": "太阴阳明", "评热病": "评热病", "刺疟": "刺疟", "刺热": "刺热",
    "八正神明": "八正神明", "通评虚实": "通评虚实", "大奇论": "大奇论",
    "脉解": "脉解", "针解": "针解", "长刺节": "长刺节", "皮部论": "皮部论",
    "气穴论": "气穴论", "气府论": "气府论", "骨空论": "骨空论",
    "水热穴": "水热穴", "调经论": "调经论", "缪刺论": "缪刺论",
    "标本病传": "标本病传", "着至教": "著至教", "疏五过": "疏五过",
    "方盛衰": "方盛衰", "解精微": "解精微", "示从容": "示从容",
    "征四失": "征四失", "阴阳类": "阴阳类", "四时刺逆从": "四时刺逆从",
    "上古天真": "上古天真", "生气通天": "生气通天", "金匮真言": "金匮真言",
    "阴阳应象大论": "阴阳应象大论", "阴阳离合": "阴阳离合", "阴阳别论": "阴阳别论",
    "灵兰秘典": "灵兰秘典", "六节藏象": "六节藏象", "异法方宜": "异法方宜",
    "移精变气": "移精变气", "汤液醪醴": "汤液醪醴", "玉版论要": "玉版论要",
    "诊要经终": "诊要经终", "脉要精微": "脉要精微", "平人气象": "平人气象",
    "三部九候": "三部九候", "经脉别论": "经脉别论", "热论": "热论",
    "逆调论": "逆调论", "疟论": "疟论", "气厥论": "气厥论", "咳论": "咳论",
    "举痛论": "举痛论", "腹中论": "腹中论", "风论": "风论", "痿论": "痿论",
    "厥论": "厥论", "病能论": "病能论", "奇病论": "奇病论", "刺要论": "刺要论",
    "刺齐论": "刺齐论", "刺禁论": "刺禁论", "刺志论": "刺志论",
    "刺法论": "刺法论", "刺节真邪": "刺节真邪",
}


def simp(s):
    return _cc.convert(s)


_CHAR_VAR = str.maketrans({"着": "著", "板": "版", "藏": "脏", "欬": "咳", "痺": "痹", "瘅": "疸", "跗": "趺", "鍼": "针", "府": "腑"})


def norm_name(s):
    """篇名归一：去尾缀 篇/论/病脉证并治 等、异体字转换，用于匹配。"""
    s = s.strip().translate(_CHAR_VAR)
    s = re.sub(r"[（(].*?[)）]", "", s)
    s = re.sub(r"(病脉证并治|病脉证治|脉证并治|脉证治|病证并治|病证治|证治)$", "", s)
    s = re.sub(r"[篇论]$", "", s)
    s = s.replace("病", "")
    return s


def load(name):
    return simp(open(os.path.join(MOD, name), encoding="utf-8").read())


def write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text.strip() + "\n")


def slice_neijing():
    text = load("08_huangdi_detail.md")
    man = json.load(open(os.path.join(ROOT, "data", "四大经典", "源文", "manifest.json"), encoding="utf-8"))
    suwen = {u["num"]: u["name"] for u in man["素问"]}
    # 名称 → 篇号（归一后匹配）
    name2num = {norm_name(nm): num for num, nm in suwen.items()}
    heads = list(re.finditer(r"^## 【人纪·黄帝内经】(.+?)篇\s*$", text, re.M))
    out, miss = [], []
    for k, m in enumerate(heads):
        name = m.group(1).strip()
        end = heads[k + 1].start() if k + 1 < len(heads) else len(text)
        body = text[m.end():end].strip()
        num = name2num.get(norm_name(name))
        if num is None:
            miss.append(name)
            continue
        write(os.path.join(J, "素问", f"{num:03d}-{suwen[num]}.md"), f"# 讲稿：{suwen[num]}\n\n{body}")
        out.append(num)
    print("素问切片:", len(out), "未匹配:", miss)
    return set(out), set(suwen)


def slice_jingui():
    man = json.load(open(os.path.join(ROOT, "data", "四大经典", "源文", "manifest.json"), encoding="utf-8"))
    jg = {u["num"]: u["name"] for u in man["金匮要略"]}
    name2num = {norm_name(re.sub(r"第[一二三四五六七八九十]+$", "", nm)): n for n, nm in jg.items()}
    got = {}
    for mod in ("04_jingui.md", "05_huangdi_neijing.md"):
        text = load(mod)
        heads = list(re.finditer(r"^## (.+第[一二三四五六七八九十]+)\s*$", text, re.M))
        for k, m in enumerate(heads):
            title = m.group(1).strip()
            end = heads[k + 1].start() if k + 1 < len(heads) else len(text)
            body = text[m.end():end].strip()
            key = norm_name(re.sub(r"第[一二三四五六七八九十]+$", "", title))
            num = name2num.get(key)
            if num is None:
                for nk, n in name2num.items():
                    if nk.startswith(key[:3]) or key.startswith(nk[:3]):
                        num = n
                        break
            if num is None:
                print("  [金匮未匹配]", mod, title)
                # 阴阳易差后劳复等伤寒内容转存伤寒讲稿
                if "阴阳易" in title:
                    write(os.path.join(J, "伤寒论", "04-阴阳易差后劳复.md"), f"# {title}\n\n{body}")
                continue
            got[num] = (title, body, mod)
    for num, (title, body, mod) in sorted(got.items()):
        write(os.path.join(J, "金匮要略", f"{num:02d}-{jg[num]}.md"), f"# 讲稿：{jg[num]}（{title}，出自模块 {mod}）\n\n{body}")
    # 前言与续伤寒篇
    t04 = load("04_jingui.md")
    for pat, out in ((r"^## 金匮上课前言\s*$", "00-前言.md"), (r"^## 续伤寒篇\s*$", None)):
        hs = list(re.finditer(pat, t04, re.M))
        for m in hs:
            nxt = re.search(r"^## ", t04[m.end():], re.M)
            body = t04[m.end(): m.end() + nxt.start()].strip() if nxt else t04[m.end():].strip()
            if out:
                write(os.path.join(J, "金匮要略", out), f"# 金匮上课前言\n\n{body}")
            else:
                write(os.path.join(J, "伤寒论", "05-续伤寒篇-霍乱等.md"), f"# 续伤寒篇\n\n{body}")
    print("金匮切片:", sorted(got))
    return set(got), set(jg)


def slice_shanghan():
    text01 = load("01_shanghan_sun.md")
    heads = list(re.finditer(r"^### ((?:太阳病[^\n]*|伤寒论补遗[^\n]*|辨太阳病脉证并治法中篇)[^\n]*)\s*$", text01, re.M))
    heads = [m for m in heads if "模型" not in m.group(1)]
    rows = []
    for n, m in enumerate(heads, 1):
        title = m.group(1).strip()
        end = heads[n].start() if n < len(heads) else len(text01)
        body = text01[m.end():end].strip()
        safe = re.sub(r"[\\/:*?\"<>|·（）()]", "-", title)[:40]
        fn = f"{n:02d}-{safe}.md"
        write(os.path.join(J, "伤寒论", "太阳", fn), f"# {title}\n\n{body}")
        rows.append((os.path.join("太阳", fn), title))
    # 13 模块分经
    t13 = load("13_shanghan_quebing.md")
    h13 = list(re.finditer(r"^## (辨阳明病脉证并治法|辨少阳病脉证并治法|伤寒论补遗[^\n]*)\s*$", t13, re.M))
    for k, m in enumerate(h13):
        title = m.group(1).strip()
        end = h13[k + 1].start() if k + 1 < len(h13) else len(t13)
        body = t13[m.end():end].strip()
        name = {"辨阳明病脉证并治法": "13-阳明.md", "辨少阳病脉证并治法": "13-少阳.md"}.get(title)
        if name is None:
            name = "13-补遗.md"
        write(os.path.join(J, "伤寒论", name), f"# {title}\n\n{body}")
        rows.append((name, title))
    # 02 模块诸经概说
    t02 = load("02_shanghan_other.md")
    i = t02.find("## 第一章：辨阳明病脉证并治法")
    if i < 0:
        i = t02.find("# 《伤寒论》阳明病")
    write(os.path.join(J, "伤寒论", "02-诸经概说.md"), t02[i:] if i > 0 else t02)
    rows.append(("02-诸经概说.md", "阳明/少阳/太阴/少阴/厥阴 概说"))
    with open(os.path.join(J, "伤寒论", "index.tsv"), "w", encoding="utf-8") as f:
        for fn, title in rows:
            f.write(f"{fn}\t{title}\n")
    print("伤寒切片:", len(rows), "件")


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    for sub in ("素问", "金匮要略", "伤寒论"):
        d = os.path.join(J, sub)
        if os.path.isdir(d):
            shutil.rmtree(d)
    a1, a2 = slice_neijing()
    b1, b2 = slice_jingui()
    slice_shanghan()
    print()
    print("素问覆盖:", len(a1), "/", len(a2), "缺:", sorted(a2 - a1))
    print("金匮覆盖:", len(b1), "/", len(b2), "缺:", sorted(b2 - b1))


if __name__ == "__main__":
    main()
