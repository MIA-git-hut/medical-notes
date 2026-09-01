# -*- coding: utf-8 -*-
"""
构建「溯本医源」中药学知识库 DuckDB 数据库

- 扫描 docs/中药学/ 下所有 .md 笔记
- 解析 frontmatter 与各 ## 小节
- 生成 data/zhongyao.duckdb 与 data/zhongyao.csv
"""
from __future__ import annotations

import csv
import re
from pathlib import Path

import duckdb

ROOT = Path(__file__).resolve().parent.parent
NOTES_DIR = ROOT / "docs" / "中药学"
DATA_DIR = ROOT / "data"
DB_PATH = DATA_DIR / "zhongyao.duckdb"
CSV_PATH = DATA_DIR / "zhongyao.csv"

FRONT_RE = re.compile(r"^---\s*\n(.*?)\n---\s*\n", re.S)
H2_RE = re.compile(r"^##\s+(.+?)\s*$")
H1_RE = re.compile(r"^#\s+.+$")

DEFAULT_TIP = "（待补充：写下你的体会——配伍、方剂、临床思路等）"


def parse_frontmatter(text: str) -> dict[str, str]:
    data: dict[str, str] = {}
    m = FRONT_RE.match(text)
    if m:
        for line in m.group(1).splitlines():
            line = line.strip()
            if ":" in line:
                k, v = line.split(":", 1)
                data[k.strip()] = v.strip()
    return data


def parse_sections(text: str) -> dict[str, list[str]]:
    """把 ## 标题映射到其原始行列表。"""
    body = FRONT_RE.sub("", text)
    body = H1_RE.sub("", body)
    sections: dict[str, list[str]] = {}
    cur: str | None = None
    buf: list[str] = []
    for line in body.splitlines():
        m = H2_RE.match(line.strip())
        if m:
            if cur is not None:
                sections[cur] = buf
            cur = m.group(1).strip()
            buf = []
        elif cur is not None:
            buf.append(line)
    if cur is not None:
        sections[cur] = buf
    return sections


def clean_lines(lines: list[str]) -> list[str]:
    """去掉引用标记、callout 标签、列表前缀、空行。"""
    out: list[str] = []
    for raw in lines:
        ln = raw.strip()
        if not ln:
            continue
        if ln.startswith(">"):
            ln = ln[1:].strip()
        ln = re.sub(r"\[!\w+\]\s*", "", ln).strip()
        if not ln:
            continue
        ln = re.sub(r"^[-*]\s+", "", ln)
        out.append(ln)
    return out


def bullets(lines: list[str]) -> list[str]:
    """提取以 - 开头的条目。"""
    items: list[str] = []
    for raw in lines:
        m = re.match(r"^[-*]\s+(.+)$", raw.strip())
        if m:
            items.append(m.group(1).strip())
    return items


def extract_callout(text: str, label: str) -> str:
    """提取 > [!label] 开头的 callout 块内容（跳过标签行）。"""
    out: list[str] = []
    in_block = False
    for ln in text.splitlines():
        s = ln.strip()
        if not in_block and re.match(r">\s*\[!%s\]" % re.escape(label), s, re.I):
            in_block = True
            continue
        if in_block:
            if s.startswith(">"):
                out.append(s.lstrip(">").strip())
            else:
                break
    return "；".join(x for x in out if x)


def extract_field(sections: dict[str, list[str]], name: str, default: str = "") -> str:
    if name not in sections:
        return default
    return "；".join(clean_lines(sections[name]))


def main() -> None:
    DATA_DIR.mkdir(exist_ok=True)
    md_files = sorted(p for p in NOTES_DIR.rglob("*.md") if p.name != "index.md")
    rows: list[dict] = []
    item_rows: list[tuple] = []

    for i, path in enumerate(md_files, 1):
        text = path.read_text(encoding="utf-8")
        fm = parse_frontmatter(text)
        sections = parse_sections(text)

        rel = path.relative_to(NOTES_DIR)
        parts = rel.parts
        chapter = parts[0]
        subsection = parts[1] if len(parts) == 3 else ""
        name = path.stem

        xingwei = ""
        guijing = ""
        if "性味归经" in sections:
            for ln in clean_lines(sections["性味归经"]):
                if ln.startswith("性味"):
                    xingwei = ln.split("：", 1)[-1].strip()
                elif ln.startswith("归经"):
                    guijing = ln.split("：", 1)[-1].strip()

        gongxiao = bullets(sections.get("功效", []))
        zhuzhi = bullets(sections.get("主治", []))

        rows.append({
            "id": i,
            "name": name,
            "chapter": chapter,
            "subsection": subsection,
            "tags": fm.get("tags", ""),
            "suji": extract_callout(text, "info"),
            "xingwei": xingwei,
            "guijing": guijing,
            "gongxiao": "；".join(gongxiao),
            "zhuzhi": "；".join(zhuzhi),
            "yongfa": extract_field(sections, "用法用量"),
            "jinji": extract_field(sections, "禁忌"),
            "yaoli": extract_field(sections, "现代药理"),
            "jianjie": extract_callout(text, "tip") or extract_field(sections, "个人见解", DEFAULT_TIP),
            "file": str(rel).replace("\\", "/"),
        })

        for item in gongxiao:
            item_rows.append((i, name, "功效", item))
        for item in zhuzhi:
            item_rows.append((i, name, "主治", item))

    print(f"扫描到 {len(md_files)} 篇，解析 {len(rows)} 味")

    con = duckdb.connect(str(DB_PATH))
    con.execute("DROP TABLE IF EXISTS herbs")
    con.execute("DROP TABLE IF EXISTS herb_items")
    con.execute("DROP VIEW IF EXISTS herb_summary")
    con.execute("""
        CREATE TABLE herbs (
            id        INTEGER PRIMARY KEY,
            name      VARCHAR,
            chapter   VARCHAR,
            subsection VARCHAR,
            tags      VARCHAR,
            suji      VARCHAR,
            xingwei   VARCHAR,
            guijing   VARCHAR,
            gongxiao  VARCHAR,
            zhuzhi    VARCHAR,
            yongfa    VARCHAR,
            jinji     VARCHAR,
            yaoli     VARCHAR,
            jianjie   VARCHAR,
            file      VARCHAR
        )
    """)
    con.execute("""
        CREATE TABLE herb_items (
            herb_id   INTEGER,
            herb_name VARCHAR,
            kind      VARCHAR,
            item      VARCHAR
        )
    """)
    con.execute("CREATE INDEX idx_items ON herb_items(herb_id, kind)")

    cols = ["id", "name", "chapter", "subsection", "tags", "suji", "xingwei", "guijing",
            "gongxiao", "zhuzhi", "yongfa", "jinji", "yaoli", "jianjie", "file"]
    con.executemany(
        f"INSERT INTO herbs VALUES ({','.join('?' * len(cols))})",
        [tuple(r[c] for c in cols) for r in rows],
    )
    con.executemany("INSERT INTO herb_items VALUES (?, ?, ?, ?)", item_rows)
    con.execute("""
        CREATE VIEW herb_summary AS
        SELECT id, name, chapter, subsection, xingwei, guijing, gongxiao
        FROM herbs
    """)

    n = con.execute("SELECT COUNT(*) FROM herbs").fetchone()[0]
    n_item = con.execute("SELECT COUNT(*) FROM herb_items").fetchone()[0]
    chapters = con.execute("SELECT COUNT(DISTINCT chapter) FROM herbs").fetchone()[0]
    print(f"herbs 表：{n} 味；herb_items 表：{n_item} 条；章节数：{chapters}")

    with CSV_PATH.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    print(f"CSV 已导出：{CSV_PATH}")
    print(f"数据库：{DB_PATH}（{DB_PATH.stat().st_size / 1024:.0f} KB）")
    con.close()


if __name__ == "__main__":
    main()
