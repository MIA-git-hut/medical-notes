# 中药学知识库 · DuckDB

将 `docs/中药学/` 下的 388 味中药笔记整理为可查询的 DuckDB 数据库。

## 文件说明

| 文件 | 说明 |
| --- | --- |
| `data/zhongyao.duckdb` | DuckDB 数据库（388 味药，可由脚本重建） |
| `data/zhongyao.csv` | 导出 CSV（utf-8-sig，Excel 可直接打开） |
| `tools/build_duckdb.py` | 解析器：扫描笔记重新生成数据库与 CSV |
| `tools/query_duckdb.py` | 命令行查询工具 |

## 快速开始

环境要求：Python 3.9+，并安装 duckdb：

```bash
python -m pip install duckdb
```

常用查询：

```bash
# 查看某味药完整档案
python tools/query_duckdb.py --name 麻黄

# 按功效检索
python tools/query_duckdb.py --gongxiao 发汗

# 按主治检索
python tools/query_duckdb.py --zhuzhi 咳嗽

# 按归经检索
python tools/query_duckdb.py --guijing 肺经

# 按章节浏览
python tools/query_duckdb.py --chapter 补虚药

# 全文模糊搜索（药名/章节/功效/主治/禁忌）
python tools/query_duckdb.py --search 孕妇

# 统计总览（章节/归经/高频功效）
python tools/query_duckdb.py --stats
```

> Windows 控制台建议加 `-X utf8` 避免乱码，例如：
> `python -X utf8 tools/query_duckdb.py --name 麻黄`

## 表结构

`herbs` 表（每味药一行）：

| 字段 | 说明 |
| --- | --- |
| id / name | 编号 / 药名 |
| chapter / subsection | 章节 / 小节（如 补虚药 / 补气药） |
| tags | 标签 |
| suji | 速记（要旨） |
| xingwei | 性味 |
| guijing | 归经 |
| gongxiao | 功效 |
| zhuzhi | 主治 |
| yongfa | 用法用量 |
| jinji | 禁忌 / 注意事项 |
| yaoli | 现代药理 |
| jianjie | 个人见解 |
| file | 源 Markdown 文件路径 |

`herb_items` 表（把功效、主治拆成单条，便于统计和检索）：
`herb_id, herb_name, kind(功效/主治), item`，已建索引 `idx_items`。

另有视图 `herb_summary`（药名 + 性味归经 + 功效摘要）。

## 常用 SQL 示例

```sql
-- 按功效检索
SELECT name, chapter FROM herbs WHERE gongxiao LIKE '%发汗解表%';

-- 按归经统计
SELECT guijing, COUNT(*) AS c FROM herbs WHERE guijing <> '' GROUP BY guijing ORDER BY c DESC;

-- 高频功效 TOP10
SELECT item, COUNT(*) AS c FROM herb_items WHERE kind = '功效' GROUP BY item ORDER BY c DESC LIMIT 10;

-- 模糊搜索（药名/功效/主治/禁忌）
SELECT name, gongxiao, zhuzhi FROM herbs
WHERE (name || chapter || gongxiao || zhuzhi || jinji) LIKE '%孕妇%';
```

## 重建数据库

修改或新增了 `docs/中药学/` 下的笔记后，重新运行：

```bash
python tools/build_duckdb.py
```

脚本会重新扫描全部笔记，覆盖 `data/zhongyao.duckdb` 和 `data/zhongyao.csv`。

## 数据规模

- 中药：388 味
- 章节：21 章
- 功效·主治条目：2136 条

## 新手一键版（双击即可，不用记命令）

- 双击 `tools/update_db.bat`：写完/改了笔记后运行，自动重建数据库
- 双击 `tools/query_herb.bat`：弹窗输入关键词即可查询（药名/功效/主治/归经/禁忌）

