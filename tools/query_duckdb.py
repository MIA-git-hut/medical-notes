# -*- coding: utf-8 -*-
"""
中药学知识库查询工具

用法示例：
  python tools/query_duckdb.py --name 麻黄
  python tools/query_duckdb.py --gongxiao 发汗解表
  python tools/query_duckdb.py --zhuzhi 咳嗽
  python tools/query_duckdb.py --guijing 肺经
  python tools/query_duckdb.py --chapter 补虚药
  python tools/query_duckdb.py --search 孕妇
  python tools/query_duckdb.py --stats
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import duckdb

DB = Path(__file__).resolve().parent.parent / "data" / "zhongyao.duckdb"

COLS = ["id", "name", "chapter", "subsection", "xingwei", "guijing",
        "gongxiao", "zhuzhi", "yongfa", "jinji", "suji"]


def open_db() -> duckdb.DuckDBPyConnection:
    return duckdb.connect(str(DB), read_only=True)


def show(con, sql, params=()):
    rows = con.execute(sql, params).fetchall()
    if not rows:
        print("（无结果）")
        return
    for r in rows:
        print(" | ".join(str(x) for x in r))


def main() -> None:
    if not DB.exists():
        sys.exit(f"找不到数据库 {DB}，请先运行 python tools/build_duckdb.py")

    ap = argparse.ArgumentParser(description="溯本医源·中药学知识库查询")
    ap.add_argument("--name", help="按药名精确查询")
    ap.add_argument("--gongxiao", help="按功效关键词检索")
    ap.add_argument("--zhuzhi", help="按主治关键词检索")
    ap.add_argument("--guijing", help="按归经检索（如 肺经）")
    ap.add_argument("--chapter", help="按章节浏览（如 补虚药）")
    ap.add_argument("--search", help="全字段模糊搜索")
    ap.add_argument("--stats", action="store_true", help="统计概览")
    args = ap.parse_args()

    con = open_db()
    sql = f"SELECT {','.join(COLS)} FROM herbs"
    conds, params = [], []

    if args.name:
        conds.append("name = ?")
        params.append(args.name)
    if args.gongxiao:
        conds.append("gongxiao LIKE ?")
        params.append(f"%{args.gongxiao}%")
    if args.zhuzhi:
        conds.append("zhuzhi LIKE ?")
        params.append(f"%{args.zhuzhi}%")
    if args.guijing:
        conds.append("guijing LIKE ?")
        params.append(f"%{args.guijing}%")
    if args.chapter:
        conds.append("chapter = ?")
        params.append(args.chapter)
    if args.search:
        conds.append("(name || chapter || subsection || gongxiao || zhuzhi || jinji || suji) LIKE ?")
        params.append(f"%{args.search}%")

    if args.stats:
        print("== 章节统计 ==")
        show(con, "SELECT chapter, COUNT(*) AS 药数 FROM herbs GROUP BY chapter ORDER BY 药数 DESC")
        print("\n== 归经 TOP10 ==")
        show(con, "SELECT guijing, COUNT(*) AS c FROM herbs WHERE guijing <> '' GROUP BY guijing ORDER BY c DESC LIMIT 10")
        print("\n== 高频功效 TOP10 ==")
        show(con, "SELECT item, COUNT(*) AS c FROM herb_items WHERE kind='功效' GROUP BY item ORDER BY c DESC LIMIT 10")
    elif conds:
        where = " AND ".join(conds)
        show(con, f"{sql} WHERE {where} ORDER BY id", params)
    else:
        ap.print_help()

    con.close()


if __name__ == "__main__":
    main()
