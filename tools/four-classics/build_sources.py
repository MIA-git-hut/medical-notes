# -*- coding: utf-8 -*-
"""把维基文库底本（繁体 wikitext）清洗、转简体、切分为单篇/单味源文。

输入: data/四大经典/底本/raw/*.txt（fetch_sources.py 抓取）
输出: data/四大经典/源文/<书名>/<编号>-<名称>.txt
      data/四大经典/源文/manifest.json（清单：编号、名称、卷、字符数等）

用法: python tools/four-classics/build_sources.py
"""
import json
import os
import re
import sys

import opencc

ROOT = r"D:\medical-notes"
RAW = os.path.join(ROOT, "data", "四大经典", "底本", "raw")
OUT = os.path.join(ROOT, "data", "四大经典", "源文")

_cc = opencc.OpenCC("t2s")


def strip_templates(text):
    """删除/替换 {{...}}（含嵌套），{{*|注}} 转（注）。"""
    out = []
    i = 0
    n = len(text)
    while i < n:
        if text.startswith("{{", i):
            depth = 1
            j = i + 2
            while j < n and depth:
                if text.startswith("{{", j):
                    depth += 1
                    j += 2
                elif text.startswith("}}", j):
                    depth -= 1
                    j += 2
                else:
                    j += 1
            inner = text[i + 2 : j - 2]
            # 行内小注模板 {{*|注}} {{**|注}} → （注）
            m = re.match(r"^\*{1,2}\|(.+)$", inner, re.S)
            if m and "\n" not in m.group(1):
                out.append("（" + m.group(1).strip() + "）")
            # 其余模板（header/Textquality/PD-old 等）整体删除
            i = j
        else:
            out.append(text[i])
            i += 1
    return "".join(out)


def clean_wikitext(text):
    text = re.sub(r"<!--.*?-->", "", text, flags=re.S)
    text = strip_templates(text)
    text = re.sub(r"\[\[[^\[\]|]*\|([^\[\]]*)\]\]", r"\1", text)  # [[a|b]]→b
    text = re.sub(r"\[\[([^\[\]|]*)\]\]", r"\1", text)  # [[a]]→a
    text = re.sub(r"-+\{(.*?)\}-+", r"\1", text, flags=re.S)  # -{...}- → 内容
    text = re.sub(r"'''''(.+?)'''''", r"\1", text)
    text = re.sub(r"'''(.+?)'''", r"\1", text)
    text = re.sub(r"''(.+?)''", r"\1", text)
    text = re.sub(r"<br\s*/?>", "\n", text)
    text = re.sub(r"<[^>]+>", "", text)
    return text


def normalize(text):
    """统一空行、去行首全角缩进、繁转简。"""
    lines = []
    for line in text.splitlines():
        line = line.strip("　 \t\u200b")
        lines.append(line)
    text = "\n".join(lines)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return _cc.convert(text)


CN = "一二三四五六七八九十"

# 篇名统一为通行写法（与站点索引页「篇目」表一致）
NAME_FIX = {
    # 素问
    "五藏生成": "五脏生成篇", "五藏别论": "五脏别论", "玉板论要": "玉版论要",
    "藏气法时": "脏气法时论", "宣明五气": "宣明五气篇", "血气形志": "血气形志篇",
    "阳明脉解": "阳明脉解篇", "刺热论": "刺热篇", "刺疟": "刺疟篇",
    "欬论": "咳论", "刺腰论痛": "刺腰痛篇", "痺论": "痹论",
    "脉解": "脉解篇", "针解": "针解篇",
    # 灵枢
    "邪气藏府病形": "邪气脏腑病形", "寿天刚柔": "寿夭刚柔", "癫狂病": "癫狂",
    "五癃精液别": "五癃津液别", "血络": "血络论", "本藏": "本脏",
    "背输": "背腧", "论疾诠尺": "论疾诊尺",
    # 金匮要略
    "痉湿暍病脉证并治第二": "痉湿暍病脉证治第二",
    "百合病狐惑阴阳毒病脉证并治第三": "百合狐惑阴阳毒病脉证治第三",
    "惊悸吐衄下血胸满瘀血病脉证并治第十六": "惊悸吐衄下血胸满瘀血病脉证治第十六",
    "跗蹶手指臂肿转筋阴狐疝蚘虫病脉证并治第十九": "趺蹶手指臂肿转筋阴狐疝蛔虫病脉证治第十九",
}


def to_int(s):
    """中文数字（一/十二/二十四）→ int。"""
    s = s.replace("廿", "二十").replace("卅", "三十")
    if not s:
        return None
    if s == "十":
        return 10
    if s.startswith("十"):
        return 10 + (CN.index(s[1]) + 1 if len(s) > 1 else 0)
    if "十" in s:
        a, _, b = s.partition("十")
        return (CN.index(a) + 1) * 10 + (CN.index(b) + 1 if b else 0)
    if len(s) == 1 and s in CN:
        return CN.index(s) + 1
    return None


def keep_paragraphs(text):
    """去掉标题行以外内容中残留的空段。"""
    paras = [p.strip() for p in re.split(r"\n\s*\n", text)]
    return "\n\n".join(p for p in paras if p)


# ---------------- 黄帝内经 ----------------

def build_neijing():
    units = []
    for part, prefixes in (("素問", ("素問-", "素问-")), ("靈樞", ("靈樞-", "灵枢-"))):
        files = sorted(
            f
            for f in os.listdir(RAW)
            if f.endswith(".txt") and any(f.startswith(p) for p in prefixes)
        )
        for fn in files:
            juan = to_int(re.findall(r"第(\d+)卷", fn)[0])
            text = normalize(clean_wikitext(open(os.path.join(RAW, fn), encoding="utf-8").read()))
            heads = list(re.finditer(r"^==\s*([^=\s].*?)\s*==\s*$", text, re.M))
            for k, m in enumerate(heads):
                title = m.group(1).strip()
                if title in ("附注", "附註"):
                    continue
                end = heads[k + 1].start() if k + 1 < len(heads) else len(text)
                body = keep_paragraphs(text[m.end() : end])
                mm = re.match(r"^(.*?)(?:篇)?第?([一二三四五六七八九十]+)$", title)
                if mm:
                    name, number = mm.group(1), to_int(mm.group(2))
                else:
                    name, number = title, None
                name = re.sub(r"篇$", "", name.strip())
                name = NAME_FIX.get(name, name)
                units.append(
                    {
                        "book": part == "素問" and "素问" or "灵枢",
                        "part": part,
                        "juan": juan,
                        "num": number,
                        "name": name,
                        "text": body,
                        "src": fn,
                    }
                )
    return units


# ---------------- 伤寒论 ----------------

def build_shanghan():
    text = normalize(
        clean_wikitext(open(os.path.join(RAW, "傷寒論-宋本.txt"), encoding="utf-8").read())
    )
    heads = list(re.finditer(r"^(={2,3})\s*(.*?)\s*\1\s*$", text, re.M))
    units = []
    # 序（林亿校序 + 张仲景原序）
    preface = []
    for k, m in enumerate(heads):
        if m.group(2) in ("林亿校序", "张仲景原序"):
            end = heads[k + 1].start() if k + 1 < len(heads) else len(text)
            preface.append((m.group(2), keep_paragraphs(text[m.end() : end])))
    # 22 篇
    juan = ""
    for k, m in enumerate(heads):
        title = m.group(2)
        if m.group(1) == "==" and title.startswith("卷"):
            juan = title
            continue
        if m.group(1) != "===":
            continue
        end = heads[k + 1].start() if k + 1 < len(heads) else len(text)
        body = text[m.end() : end]
        body = fix_fang(body)
        num = to_int(re.findall(r"第([一二三四五六七八九十]+)$", title)[0])
        units.append(
            {
                "book": "伤寒论",
                "num": num,
                "name": title,
                "juan": juan,
                "text": keep_paragraphs(body),
            }
        )
    return preface, units


def fix_fang(body):
    """把 :;方名 / ::组成 / ::用法 变成【方名】+ 组成/用法 行；处理 <br/> 版。"""
    lines = body.splitlines()
    out = []
    i = 0
    while i < len(lines):
        line = lines[i].strip("　 ")
        if line.startswith(":;"):
            name = line[2:].strip().rstrip("：:")
            comp, usage = [], []
            i += 1
            while i < len(lines) and lines[i].strip("　 ").startswith("::"):
                item = lines[i].strip("　 ")[2:].strip()
                if not comp:
                    comp.append(item)
                else:
                    usage.append(item)
                i += 1
            out.append("")
            out.append(f"【{name}】")
            if comp:
                out.append("组成：" + re.sub(r"[　\s]+", "、", comp[0]))
            if usage:
                out.append("用法：" + "".join(usage))
            out.append("")
            continue
        out.append(lines[i])
        i += 1
    return "\n".join(out)


# ---------------- 金匮要略 ----------------

def build_jingui():
    text = normalize(
        clean_wikitext(open(os.path.join(RAW, "金匱要略.txt"), encoding="utf-8").read())
    )
    heads = list(re.finditer(r"^==\s*([^=\s].*?)\s*==\s*$", text, re.M))
    units = []
    for k, m in enumerate(heads):
        title = m.group(1)
        end = heads[k + 1].start() if k + 1 < len(heads) else len(text)
        body = text[m.end() : end]
        body = re.sub(r"^===\s*(.+?)\s*===\s*$", r"【\1】", body, flags=re.M)
        body = fix_fang(body)
        body = keep_paragraphs(body)
        num = to_int(re.findall(r"第([一二三四五六七八九十]+)$", title)[0])
        title = NAME_FIX.get(title, title)
        units.append({"book": "金匮要略", "num": num, "name": title, "text": body})
    return units


# ---------------- 神农本草经 ----------------

# 本辑本中的异写/讹字，统一为通行药名（页面小注注明辑本原写）
BC_RENAME = {
    "吴公": "蜈蚣", "白莫": "白英", "落石": "络石", "著实": "蓍实",
    "蘗木": "檗木", "五味": "五味子", "鸡头": "鸡头实", "狗阴茎": "牡狗阴茎",
    "柳华": "柳花", "桃核": "桃核仁", "杏核": "杏核仁", "青葙": "青葙子",
    "苏核": "蕤核", "虾蟇": "虾蟆",
}

# 本辑本把通行单列的药并入宿主条中，析出后需从宿主原文里剪除该段
BC_SPLIT_HOST = {
    "瓜蒂": "甘瓜子", "戎盐": "卤咸", "文蛤": "海蛤",
    "薤": "葱实", "鼠李": "郁核", "牛角鳃": "牛黄",
}

# 通行 365 味中本辑本并入他条或漏收者，据孙星衍辑本补录（页面小注注明来源）
BC_SUPPLEMENTS = [
    {
        "name": "细辛",
        "pin": "上经",
        "bu": "草部上品",
        "after": "龙胆",
        "kind": "补录",
        "text": "味辛，温。主咳逆，头痛脑动，百节拘挛，风湿痹痛，死肌。久服明目，利九窍，轻身长年。一名小辛。生山谷。",
    },
    {
        "name": "扁青",
        "pin": "上经",
        "bu": "玉石部上品",
        "after": "白青",
        "kind": "补录",
        "text": "味甘，平。主目痛，明目，折跌，痈肿，金创不瘳，破积聚，解毒气，利精神。久服轻身不老。生山谷。",
    },
    {
        "name": "瓜蒂",
        "pin": "上经",
        "bu": "果菜部上品",
        "after": "甘瓜子",
        "kind": "析出",
        "text": "味苦，寒。主大水，身面四肢浮肿，下水，杀蛊毒，咳逆上气，及食诸果，病在胸腹中，皆吐下之。生平泽。",
    },
    {
        "name": "戎盐",
        "pin": "下经",
        "bu": "玉石部下品",
        "after": "卤咸",
        "kind": "析出",
        "text": "味咸，寒。主明目，目痛，益气，坚肌骨，去毒蛊。生池泽。",
    },
    {
        "name": "文蛤",
        "pin": "中经",
        "bu": "虫兽部中品",
        "after": "海蛤",
        "kind": "析出",
        "text": "味咸，平。主恶疮，蚀五痔。生东海，表有文，采无时。",
    },
    {
        "name": "薤",
        "pin": "中经",
        "bu": "果菜部中品",
        "after": "葱实",
        "kind": "析出",
        "text": "味辛，温。主金创，创败，轻身，不饥，耐老。生平泽。",
    },
    {
        "name": "鼠李",
        "pin": "下经",
        "bu": "木部下品",
        "after": "郁核",
        "kind": "析出",
        "text": "主寒热，瘰疬疮。生田野。一名牛李，一名鼠梓。",
    },
    {
        "name": "牛角鳃",
        "pin": "中经",
        "bu": "虫兽部中品",
        "after": "牛黄",
        "kind": "析出",
        "text": "下闭血，瘀血疼痛，女人带下血。髓：补中，填骨髓。久服增年。胆：可丸药。",
    },
]


def build_bencao():
    text = normalize(
        clean_wikitext(open(os.path.join(RAW, "神農本草經.txt"), encoding="utf-8").read())
    )
    units = []
    cur_pin, cur_bu = "", ""
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        m = re.match(r"^==\s*(上经|中经|下经)\s*==$", line)
        if m:
            cur_pin = m.group(1)
            continue
        m = re.match(r"^===\s*(.+?)\s*===$", line)
        if m:
            cur_bu = m.group(1)
            continue
        if line.startswith(("Category:", "分类:")):
            continue
        # 药物条目：形如  药名　味X…  或 药名<TAB>…
        m = re.match(r"^([\u3400-\u9fff\U00020000-\U0002FFFF（）()]{1,15})[　\s]+(.+)$", line)
        if m and cur_pin and cur_bu not in ("序",):
            units.append(
                {
                    "book": "神农本草经",
                    "pin": cur_pin,
                    "bu": cur_bu,
                    "name": m.group(1),
                    "text": m.group(2).strip().replace("*", ""),
                }
            )
    # 异写统一为通行药名
    for u in units:
        u["orig_name"] = BC_RENAME.get(u["name"], u["name"])
        u["name"] = u["orig_name"]
    # 从宿主条原文中剪除已析出的子条目段（保留宿主最后一句）
    for sup, host in BC_SPLIT_HOST.items():
        for u in units:
            if u["name"] == host:
                u["text"] = re.sub(
                    rf"[。；]{re.escape(sup)}[，、：][\s\S]*$", "。", u["text"]
                )
    # 插入补录条目（找到 after 条目后插在其后）
    for sup in BC_SUPPLEMENTS:
        idx = next(
            (i for i, u in enumerate(units) if u["name"] == sup["after"]), None
        )
        if idx is None:
            print("  [warn] 补录定位失败:", sup["name"], "after", sup["after"])
            units.append({"book": "神农本草经", "pin": sup["pin"], "bu": sup["bu"], "name": sup["name"], "text": sup["text"], "supplement": sup["kind"]})
        else:
            units.insert(
                idx + 1,
                {"book": "神农本草经", "pin": sup["pin"], "bu": sup["bu"], "name": sup["name"], "text": sup["text"], "supplement": sup["kind"]},
            )
    return units


def main():
    manifest = {"素问": [], "灵枢": [], "伤寒论": [], "金匮要略": [], "神农本草经": []}

    nj = build_neijing()
    for u in nj:
        manifest[u["part"] == "素問" and "素问" or "灵枢"].append(u)

    preface, ss = build_shanghan()
    manifest["伤寒论"] = ss
    manifest["伤寒论序"] = [{"name": n, "text": t} for n, t in preface]

    jg = build_jingui()
    manifest["金匮要略"] = jg

    bc = build_bencao()
    manifest["神农本草经"] = bc

    # 写文件
    def dump(folder, seq, keyname):
        d = os.path.join(OUT, folder)
        os.makedirs(d, exist_ok=True)
        for old in os.listdir(d):
            if old.endswith(".txt"):
                os.remove(os.path.join(d, old))
        for i, u in enumerate(seq, 1):
            fn = f"{i:03d}-{u.get('name','')}.txt"
            with open(os.path.join(d, fn), "w", encoding="utf-8") as f:
                f.write(u["text"])
            u["file"] = fn
            u["chars"] = len(u["text"])

    dump("素问", manifest["素问"], "name")
    dump("灵枢", manifest["灵枢"], "name")
    dump("伤寒论", manifest["伤寒论"], "name")
    dump("金匮要略", manifest["金匮要略"], "name")
    dump("神农本草经", manifest["神农本草经"], "name")

    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=1)

    # 统计
    print("素问:", len(manifest["素问"]), "篇")
    print("灵枢:", len(manifest["灵枢"]), "篇")
    print("伤寒论:", len(manifest["伤寒论"]), "篇; 序:", len(manifest["伤寒论序"]))
    print("金匮要略:", len(manifest["金匮要略"]), "篇")
    print("神农本草经:", len(manifest["神农本草经"]), "味")
    total = sum(u.get("chars", 0) for k in manifest for u in manifest[k])
    print("总字数(源文):", total)


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main()
