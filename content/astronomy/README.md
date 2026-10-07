# 星图数据

本目录单独保留天文数据出处与许可，不代表仓库其他内容采用同一许可。

- `stellarium-mansions.json`：Stellarium 中国星空文化的二十八宿摘录，固定提交及原文件 SHA-256 见 `source`。保留原始连线、编号主星、剔除记录和存疑对应；连线仅保留两端均为确认主星的原始相邻边，不跨接被删除的顶点。
- `hipparcos.tsv`：ESA 1997 Hipparcos 星表 `I/239/hip_main` 的相关恒星摘录，VizieR 查询地址与字段说明保留于文件头。RAICRS/DEICRS 为 ICRS 坐标，历元 J1991.25；Vmag 为 Johnson V 视星等。
- `mansions.json`：前端用的关联结果。运行 `node tools/build-star-charts.mjs` 从以上离线资料重建，无运行时外部请求。缺坐标会报错，不生成占位星。
- `shared/star-projection.ts`：根据球面坐标局部投影，北上东左、等比缩放；各宿在首页圆环上等分排列仅用于导航，不代表天区真实宽度。

Stellarium 数据署名：Karrie Berglund / Digitalis Education Solutions, Inc.、Sun Shuwei、Stellarium 团队；更多来源见固定版本的 `description.md` 与映射文件 `source`。

Stellarium 文字及连线数据，以及本项目衍生的筛选映射和星图：**CC BY-SA 4.0**（[许可全文](https://creativecommons.org/licenses/by-sa/4.0/legalcode)）。改动包括摘取二十八宿、剔除附属和增星、排除带问号的候选、关联星位及投影绘制。源图像未使用。

坐标来源：[ESA The Hipparcos and Tycho Catalogues (1997)](https://cdsarc.cds.unistra.fr/viz-bin/cat/I/239)，经 CDS Strasbourg 的 VizieR 星表服务获取；请保留其来源与文件头信息。

翼宿：本版15颗主星对应明确，3颗对应在来源中带问号，4颗无对应；仅绘制15颗明确者。候选记录仍可在映射文件核查，不以增星凑数。
