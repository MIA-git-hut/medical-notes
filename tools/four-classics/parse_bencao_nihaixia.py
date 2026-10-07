# -*- coding: utf-8 -*-
"""解析 09_zhenjiu_bencao.md 中「人纪·神农本草经」上/中/下经药物条目为 JSON。

输出: data/四大经典/讲稿/本经_nihaixia.json
      [{name, alias, pin, source_index, fields: {原文,性味,主治,用量,禁忌,容川,倪注,兼治...}, oral: [...]}]
"""
import json
import os
import re
import sys

import opencc

ROOT = r"D:\medical-notes"
MOD = os.path.join(ROOT, "data", "四大经典", "讲稿", "modules", "09_zhenjiu_bencao.md")
OUT = os.path.join(ROOT, "data", "四大经典", "讲稿", "本经_nihaixia.json")
_cc = opencc.OpenCC("t2s")


def clean(s):
    s = _cc.convert(s)
    s = s.replace("\u200b", "")
    # 去掉 PDF 页眉残留
    s = re.sub(r"倪注神农本草经\s*V[\d.]+", "", s)
    s = re.sub(r"倪注神农本草经", "", s)
    s = re.sub(r"[ \t]+", "", s)  # CJK 文本内部空白为 OCR 产物
    return s.strip()


BLEED = re.compile(r"(?:[0-9]{1,3})?[一二三四五六七八九十○〇百]{2,6}、([^【]{2,8})【本经原文】")


def split_bleed(entries):
    """排版串行：某药「原文」后紧跟下一味的条目头（如「63一五七、干姜【本经原文】…」）。

    原文截断到串行处，其后解析出的字段实为下一味的，移交过去。
    """
    out = []
    for e in entries:
        v = e["fields"].get("原文", "")
        m = BLEED.search(v)
        if not m:
            out.append(e)
            continue
        e["fields"]["原文"] = v[:m.start()].strip()
        keys = list(e["fields"].keys())
        moved = {k: e["fields"].pop(k) for k in keys[keys.index("原文") + 1:]}
        name = clean(m.group(1))
        tgt = next((x for x in entries if x["name"] == name), None)
        if tgt is None and moved:
            tgt = {"name": name, "alias": "", "pin": e["pin"], "fields": {}, "oral": []}
            entries.append(tgt)
            out.append(e)
            out.append(tgt)
        else:
            out.append(e)
        for k, val in moved.items():
            if tgt is not None:
                tgt["fields"].setdefault(k, val)
    return out


def parse():
    text = open(MOD, encoding="utf-8").read()
    text = _cc.convert(text)
    # 只取 人纪·神农本草经 章节，至 上/中/下经区段
    start = text.find("## 人纪·神农本草经")
    end = text.find("# 天纪体系")
    body = text[start:end]
    entries = []
    cur_pin = None
    cur = None
    in_oral = False
    KEY = re.compile(r"^-\s*(原文|性味|主治|用量|禁忌|容川|倪注|兼治|禁忌及用量|炮制|别名|附)[：:]\s*(.*)$")
    for line in body.splitlines():
        line = line.rstrip()
        if not line:
            continue
        m = re.match(r"^###\s*(上经|中经|下经)", line)
        if m:
            cur_pin = m.group(1)
            continue
        if cur_pin is None:
            continue
        if re.match(r"^#{1,4}\s", line):  # 其他标题（药性总义等）
            if not re.match(r"^###(上经|中经|下经)", line):
                continue
        m = re.match(r"^\*\*(.+?)\*\*$", line.strip())
        if m:
            title = m.group(1).strip()
            if title == "倪师临床口述" or title.startswith("倪师临床口述"):
                in_oral = True
                continue
            name = title
            alias = ""
            ma = re.match(r"^(.+?)（(?:又名|别名)?(.+?)）$", title)
            if ma:
                name, alias = ma.group(1), ma.group(2)
            cur = {"name": clean(name), "alias": clean(alias), "pin": cur_pin,
                   "fields": {}, "oral": []}
            entries.append(cur)
            in_oral = False
            continue
        if cur is None:
            continue
        if re.match(r"^[-*\s]*倪师临床口述", line.strip()):
            in_oral = True
            continue
        if in_oral:
            if line.startswith("-"):
                cur["oral"].append(clean(line.lstrip("- ")))
            else:
                cur["oral"].append(clean(line))
            continue
        m = KEY.match(line.strip())
        if m:
            k, v = m.group(1), m.group(2)
            if k in cur["fields"] and v:
                cur["fields"][k] += " " + clean(v)
            elif v:
                cur["fields"][k] = clean(v)
            continue
        # 非匹配行：若紧接某字段的续行，追加
        if cur["fields"]:
            lastk = list(cur["fields"])[-1]
            cur["fields"][lastk] += clean(line.strip())
    return split_bleed(entries)


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    entries = parse()
    pin_count = {}
    for e in entries:
        pin_count[e["pin"]] = pin_count.get(e["pin"], 0) + 1
    print("解析条目:", len(entries), pin_count)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=1)
    print("写出:", OUT)
    # 抽查
    for e in entries[:3] + entries[100:102]:
        print("-", e["pin"], e["name"], "| fields:", list(e["fields"].keys()), "| oral:", len(e["oral"]))


if __name__ == "__main__":
    main()
