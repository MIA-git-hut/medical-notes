# -*- coding: utf-8 -*-
"""中药知识库 · 交互查询（给小白用的，双击 query_herb.bat 即可）"""
import sys
from pathlib import Path

import duckdb

DB = Path(__file__).resolve().parent.parent / "data" / "zhongyao.duckdb"

SQL = """
SELECT name, chapter, suji, xingwei, guijing, gongxiao, zhuzhi
FROM herbs
WHERE (name || chapter || subsection || gongxiao || zhuzhi || guijing || jinji) LIKE ?
ORDER BY name
LIMIT 30
"""


def main():
    if not DB.exists():
        print(f"未找到数据库：{DB}")
        print("请先双击 tools\\update_db.bat 生成数据库。")
        return
    con = duckdb.connect(str(DB), read_only=True)
    print("=== 溯本医源 · 中药查询 ===")
    print("输入任意关键词（药名 / 功效 / 主治 / 归经 / 禁忌），直接回车退出。")
    while True:
        try:
            kw = input("\n查询: ").strip()
        except EOFError:
            break
        if not kw:
            break
        rows = con.execute(SQL, [f"%{kw}%"]).fetchall()
        if not rows:
            print("没有找到，换个关键词试试。")
            continue
        for name, chapter, suji, xingwei, guijing, gongxiao, zhuzhi in rows:
            print(f"{name}（{chapter}）")
            print(f"    速记: {suji}")
            print(f"    性味: {xingwei} | 归经: {guijing}")
            print(f"    功效: {gongxiao}")
            print(f"    主治: {zhuzhi}")
            print()
    con.close()
    print("再见！")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n再见！")

