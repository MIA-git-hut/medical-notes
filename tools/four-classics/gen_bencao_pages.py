# -*- coding: utf-8 -*-
r"""生成《神农本草经》367 味药物页面。

输入: data/四大经典/源文/manifest.json（神农本草经 部分，含编号/三品/部类/原文/补录标记）
      data/四大经典/讲稿/本经_nihaixia.json（倪海厦讲座结构化解说）
输出: docs/四大经典/神农本草经/NNN-药名.md（000-序录.md 由原 1-序录.md 改名而来）

用法: python tools/four-classics/gen_bencao_pages.py [--report]
注: 本文件内正则一律不用反斜杠转义（[0-9] 代替 \d，re.S 代替 [\s\S]）。
"""
import difflib
import glob
import json
import os
import re
import sys

ROOT = r"D:\medical-notes"
SRC = os.path.join(ROOT, "data", "四大经典", "源文", "manifest.json")
NI = os.path.join(ROOT, "data", "四大经典", "讲稿", "本经_nihaixia.json")
OUT = os.path.join(ROOT, "docs", "四大经典", "神农本草经")

# 倪海厦讲座用名 → 通行辑本用名（仅列不一致者）
NI2SRC = {
    "涅石": "矾石", "白术": "术", "女萎": "委萎", "薏苡仁": "薏苡人",
    "黄耆": "黄芪", "徐长卿": "石下长卿", "菌桂": "箘桂", "槐实": "槐子",
    "桑蜱蛸": "桑螵蛸", "蠡鱼": "鳢鱼", "蒲萄": "蒲陶", "蓬蘽": "蓬蔂",
    "石硫黄": "石流黄", "铁精": "铁落", "枲耳实": "葈耳实", "瓜篓根": "栝楼",
    "紫苑": "紫菀", "酸浆": "酸酱", "槀本": "蒿本", "石苇": "石韦",
    "栀子": "支子", "燕屎": "鷰屎", "蜚蠊": "蜚廉", "粉钖": "粉锡",
    "青琅玕": "青瑯玕", "葶苈": "亭历", "旋复花": "旋覆花", "蛇含": "蛇全",
    "白敛": "白蔹", "荛花": "荛华", "萹蓄": "扁蓄", "白头翁": "白头公",
    "蔺茹": "闾茹", "盖草": "荩草", "芫花": "芫华", "楝实": "练实",
    "郁李仁": "郁核", "药实根": "药食根", "栾花": "栾华", "斑蟊": "螌蝥",
    "蜣螂": "蜣蜋", "青盐": "戎盐", "牙子": "狼牙", "莨菪子": "莨荡子",
    "太一余粮": "太一禹余粮", "紫石英": "紫石", "昌蒲": "菖蒲", "芎穷": "芎䓖",
    "茵陈": "茵陈蒿", "白瓜子": "甘瓜子", "白鲜皮": "白鲜", "款冬花": "款冬",
    "薤白": "薤", "古南": "石南草",
}

# 倪讲座把数味药合在一节讲，对应多个源文条目
NI2SRC_MULTI = {
    "蜂子，蜂蜜，蜂蜡": ["蜂子", "蜜蜡"],
}

# 辑本原写 → 通行名（页面「版本与文字小注」注明）
RENAME_NOTE = {
    "蜈蚣": "吴公", "白英": "白莫", "络石": "落石", "蓍实": "著实",
    "檗木": "蘗木", "五味子": "五味", "鸡头实": "鸡头", "牡狗阴茎": "狗阴茎",
    "柳花": "柳华", "桃核仁": "桃核", "杏核仁": "杏核", "青葙子": "青葙",
    "蕤核": "苏核", "虾蟆": "虾蟇",
}

# 补录/析出条目的版本小注
SUP_NOTE = {
    "细辛": "本辑本未见此条，据孙星衍辑《神农本草经》补录。",
    "扁青": "本辑本未见此条，据孙星衍辑《神农本草经》补录。",
    "瓜蒂": "本辑本并入「甘瓜子」条，此据孙星衍辑本析出单列。",
    "戎盐": "本辑本并入「卤咸」条，此据孙星衍辑本析出单列。",
    "文蛤": "本辑本并入「海蛤」条，此据孙星衍辑本析出单列。",
    "薤": "本辑本并入「葱实」条，此据孙星衍辑本析出单列。",
    "鼠李": "本辑本并入「郁核」条，此据孙星衍辑本析出单列。",
    "牛角鳃": "本辑本并入「牛黄」条，此据孙星衍辑本析出单列。",
}

# 辑本将数味合为一条者（原文分行列出，此处说明）
MERGED_NOTE = {
    "铁落": "本辑本「铁落」条下并载「铁」「铁精」，原文分列；此条以「铁落」为主。",
    "粉锡": "本辑本「粉锡」条下并载「锡铜镜鼻」，原文分列；此条以「粉锡」为主。",
}

CJK = "一-鿿"
CN_NUM = "一二三四五六七八九十○〇百千"
END_PUNCT = "。，；：、！？"

# 结构化字段里混入课堂口语的起始标记（其后为倪师讲课原话）
LECT_MARK = (
    "【(?:本经原文|产地|性味|主治|用量|禁忌|炮制|禁忌及用量|用量及禁忌)】"
    "|倪师临床口述"
    "|再来是|诸位|一般来说|我们叫做|那这个|很简单|对不对"
    "|第[" + CN_NUM + "]{1,8}[，,]"
    "|[0-9]{1,3}(?=[，,]|[" + CJK + "])"
)


def tidy(s):
    """清理讲座文本中的 OCR/排版残留（页眉页脚、页码、串入的下一节标题）。"""
    s = s.replace("倪注神农本草经", "").replace("（视频讲义）", "")
    s = re.sub("V[0-9]+([.][0-9]+)*", "", s)
    # 页码 + 下一节标题（如「26五十五、黄连」）起，其后属下一节，整段截去
    s = re.sub("[0-9]{1,3}[" + CN_NUM + "]{1,4}、.*", "", s, flags=re.S)
    # 散在文中的页码（数字前后皆汉字/标点）
    s = re.sub("(?<=[" + CJK + END_PUNCT + "])[0-9]{1,3}(?=[" + CJK + "])", "", s)
    s = re.sub("[0-9]{1,3}(?=[，。；：、）)])", "", s)
    s = re.sub("(?<=[（(])[0-9]{1,3}", "", s)
    s = re.sub("[0-9]{1,3}$", "", s)
    s = s.replace("　", "")
    return s.strip("。，、； 　")


def split_lect(v):
    """切开字段里混入的课堂口语，返回（条文, 讲课原话）。"""
    if len(v) > 8:
        m = re.search(LECT_MARK, v[4:])
        if m:
            i = 4 + m.start()
            head = re.sub("(但是|可是|那么|所以|还有|这个|那|呢|啊|哦|嘛|好|来说)+$", "", v[:i])
            return head.strip("-—·，。、； 　"), v[i:].strip()
    return v, ""


NEXT_ENTRY = re.compile("【本经原文】|^[0-9]*[" + CN_NUM + "]{2,}、")


def fld(f, key):
    """取字段：切开混入的讲课原话，各自清理。返回（条文, 口语）。"""
    h, t = split_lect(f.get(key, ""))
    h = tidy(h)
    # 串入的下一味药条目（「NN二三〇、天鼠屎【本经原文】…」）不是讲课原话，弃去
    if t and not NEXT_ENTRY.search(t[:24]):
        return h, tidy(t)
    return h, ""


def load_wang():
    """中药学卡片页名集合，用于「对照教材」双链。"""
    names = set()
    for p in glob.glob(os.path.join(ROOT, "docs", "中药学", "**", "*.md"), recursive=True):
        b = os.path.basename(p)[:-3]
        if b != "index":
            names.add(b)
    return names


def match(ni_entries):
    """返回 {源文名: 倪条目}。"""
    ni_entries = [e for e in ni_entries if e["fields"] or e["oral"]]
    by_name = {}
    for e in ni_entries:
        by_name.setdefault(e["name"], e)
        if e.get("alias"):
            for a in re.split("[、，,]", e["alias"]):
                if a.strip():
                    by_name.setdefault(a.strip(), e)
    for ni_name, src_name in NI2SRC.items():
        if ni_name in by_name and src_name not in by_name:
            by_name[src_name] = by_name[ni_name]
    for ni_name, src_names in NI2SRC_MULTI.items():
        if ni_name in by_name:
            for src_name in src_names:
                by_name.setdefault(src_name, by_name[ni_name])
    return by_name


def build(units, by_name):
    pages, nomatch = [], []
    for u in units:
        e = by_name.get(u["name"])
        if e is None:
            nomatch.append(u["name"])
        pages.append((u, e))
    return pages, nomatch


def fmt_oral(oral):
    out = []
    for b in oral:
        b = b.strip().lstrip("-—–· ")
        b = b.rstrip("，。、").strip()
        if b:
            out.append(b)
    return out


def differs(a, b):
    """讲义原文与辑本原文是否有实质差异（仅标点/个别字出入的略过）。"""
    na = re.sub("[^" + CJK + "]", "", a)
    nb = re.sub("[^" + CJK + "]", "", b)
    if not nb:
        return False
    if not na:
        return True
    return difflib.SequenceMatcher(None, na, nb).ratio() < 0.93


def drug_page(u, e, wang):
    name = u["name"]
    pin, bu = u["pin"], u["bu"]
    f = (e or {}).get("fields", {})
    oral = fmt_oral((e or {}).get("oral", []))
    rz = tidy(f.get("倪注", ""))
    rc = tidy(f.get("容川", ""))
    xw, xw_t = fld(f, "性味")
    zz, zz_t = fld(f, "主治")
    yl, yl_t = fld(f, "用量")
    jj, jj_t = fld(f, "禁忌")
    ny_show, ny_t = fld(f, "原文")
    oral_all = "".join(oral)
    prose = [t for t in (ny_t, xw_t, zz_t, yl_t, jj_t) if len(t) >= 20 and t[:16] not in oral_all]
    if ny_show and not differs(u["text"], ny_show):
        ny_show = ""
    has_fields = any(k in f for k in ("性味", "主治", "用量", "禁忌"))
    has_expl = bool(oral or rz or rc or ny_show or prose)
    tags = ["神农本草经", pin, bu]
    if has_fields or has_expl:
        tags.append("倪海厦")
    L = []
    L.append("---")
    L.append(f"title: {name}")
    L.append("分类: 神农本草经")
    L.append(f"tags: [{', '.join(tags)}]")
    L.append("---")
    L.append("")
    L.append(f"# {name}")
    L.append("")

    edu = f"本页为《神农本草经》{pin}（{bu}）药物，原文据通行辑本文字转写简体"
    if has_fields and has_expl:
        edu += ("；「学习要点」的「性味」「主治」「用量」「禁忌」与「解说」均摘自倪海厦《人纪·神农本草经》讲座讲义，"
                "属其个人讲解风格，供对照学习")
    elif has_fields:
        edu += "；「学习要点」的「性味」「主治」「用量」「禁忌」摘自倪海厦《人纪·神农本草经》讲座讲义，属其个人讲解风格，供对照学习"
    elif has_expl:
        edu += "；「解说」摘自倪海厦《人纪·神农本草经》讲座讲义（含其诵记原文与后世注文），供对照学习"
    else:
        edu += "；倪海厦《人纪·神农本草经》讲座未及此药，可参序录页「药性总义」总则学习"
    if name in SUP_NOTE:
        edu += "。" + SUP_NOTE[name].rstrip("。")
    L.append(f"> [!note] {edu}。")
    L.append("")

    # 学习要点
    if not xw:
        seg = u["text"].split("。")[0]
        xw = seg if len(seg) <= 14 and seg.startswith("味") else "见原文"
    if not zz:
        m = re.search("(主[^。]{0,60})", u["text"])
        zz = m.group(1) if m else "见原文"
    L.append("## 学习要点")
    L.append("")
    L.append(f"- 性味：{xw}")
    L.append(f"- 主治：{zz}")
    if yl:
        L.append(f"- 用量：{yl}")
    if jj:
        L.append(f"- 禁忌：{jj}")
    L.append("")

    L.append("## 原文")
    L.append("")
    # 辑本以全角空格分隔同一味下的合条（如「铁落」下并载「铁」「铁精」），分行列出
    for seg in u["text"].split("　"):
        if seg.strip():
            L.append(f"> {seg.strip()}")
            L.append(">")
    L.pop()
    L.append("")

    # 解说
    if has_expl:
        L.append("## 倪海厦《人纪》解说")
        L.append("")
        L.append(f"> 以下要点摘编自倪海厦《人纪·神农本草经》讲座中「{name}」一节，属其个人讲解风格，供对照学习。")
        L.append("")
        if ny_show:
            L.append("**讲义所据原文**（含后世附注，与辑本文字互有出入）")
            L.append("")
            L.append(f"> {ny_show}")
            L.append("")
        for b in oral:
            L.append(f"- {b}")
        if oral:
            L.append("")
        if rz:
            L.append(f"- 倪师注：{rz}")
        if rc:
            L.append(f"- 唐容川：{rc}")
        if rz or rc:
            L.append("")
        if prose:
            L.append("**讲座笔录**（讲义中随该药讲述的原话，照录未删）")
            L.append("")
            for t in prose:
                L.append(f"> {t}")
                L.append(">")
            L.pop()
            L.append("")

    # 版本与文字小注
    notes = ["原书早佚，文字据通行辑本转写简体，各辑本句读、字词略有出入。"]
    if name in RENAME_NOTE:
        notes.append(f"本辑本原作「{RENAME_NOTE[name]}」，此从通行药名。")
    if name in MERGED_NOTE:
        notes.append(MERGED_NOTE[name])
    if name in SUP_NOTE:
        notes.append(SUP_NOTE[name])
    if u.get("supplement"):
        notes.append(f"本页条目属「{u['supplement']}」，与通行 365 味次序略异，编号以本辑本次序为准。")
    L.append("## 版本与文字小注")
    L.append("")
    for n in notes:
        L.append(f"- {n}")
    if name in wang:
        L.append(f"- 对照「十五五」规划教材《中药学》：[[{name}]]。")
    L.append("")
    return "\n".join(L)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    man = json.load(open(SRC, encoding="utf-8"))
    units = man["神农本草经"]
    ni = json.load(open(NI, encoding="utf-8"))
    by_name = match(ni)
    pages, nomatch = build(units, by_name)

    used = {id(e) for _, e in pages if e}
    unused = [e["name"] for e in ni if id(e) not in used and (e["fields"] or e["oral"])]
    print(f"源文 {len(units)} 味；匹配到倪解说 {len(units) - len(nomatch)} 味")
    print("未匹配(将生成不含倪解说的页面):", len(nomatch))
    print("  ", "、".join(nomatch))
    print("倪条目未用上(讲义含后世药/别名未识别):", len(unused))
    print("  ", "、".join(unused))

    if "--report" in sys.argv:
        return

    wang = load_wang()
    os.makedirs(OUT, exist_ok=True)
    for i, (u, e) in enumerate(pages, 1):
        fn = f"{i:03d}-{u['name']}.md"
        with open(os.path.join(OUT, fn), "w", encoding="utf-8") as fh:
            fh.write(drug_page(u, e, wang))
    old = os.path.join(OUT, "1-序录.md")
    new = os.path.join(OUT, "000-序录.md")
    if os.path.exists(old) and not os.path.exists(new):
        os.rename(old, new)
        print("已改名: 1-序录.md → 000-序录.md")
    print("已生成:", len(pages), "页 →", OUT)


if __name__ == "__main__":
    main()
