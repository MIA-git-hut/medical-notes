"""从维基文库抓取四大经典底本（原样 wikitext，繁体）。

用法: python fetch_sources.py
输出: D:/medical-notes/data/四大经典/底本/raw/*.txt
"""
import urllib.request
import urllib.parse
import os
import time
import sys

OUT = r"D:\medical-notes\data\四大经典\底本\raw"
UA = {
    "User-Agent": "medical-notes-study-site/1.0 (personal TCM study notes; github.com/MIA-git-hut/medical-notes)"
}

CN = "一二三四五六七八九十"


def cn_num(n):
    if n <= 10:
        return CN[n - 1]
    if n < 20:
        return "十" + CN[n - 11]
    if n == 20:
        return "二十"
    return "二十" + CN[n - 21]


def fetch_raw(title):
    url = "https://zh.wikisource.org/w/index.php?" + urllib.parse.urlencode(
        {"title": title, "action": "raw"}
    )
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=30) as r:
        return r.read().decode("utf-8")


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = []
    for i in range(1, 25):
        jobs.append((f"黃帝內經/素問第{cn_num(i)}卷", f"素問-第{i:02d}卷.txt"))
    for i in range(1, 13):
        jobs.append((f"黃帝內經/靈樞第{cn_num(i)}卷", f"靈樞-第{i:02d}卷.txt"))
    jobs.append(("傷寒論", "傷寒論-宋本.txt"))
    jobs.append(("金匱要略", "金匱要略.txt"))
    jobs.append(("神農本草經", "神農本草經.txt"))

    for title, fname in jobs:
        path = os.path.join(OUT, fname)
        if os.path.exists(path) and os.path.getsize(path) > 500:
            print(f"[skip] {fname}")
            continue
        try:
            text = fetch_raw(title)
            with open(path, "w", encoding="utf-8") as f:
                f.write(text)
            print(f"[ok]   {fname}  {len(text)} chars")
        except Exception as e:
            print(f"[FAIL] {fname}: {e}", file=sys.stderr)
        time.sleep(1.0)


if __name__ == "__main__":
    main()
