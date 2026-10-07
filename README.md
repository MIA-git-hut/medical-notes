# 溯本医源 · yixuebiji.top

中医知识整理与检索站点，基于 VitePress 构建，DeepSeek API + Claude 辅助开发。

**定位与边界**：只做知识整理与检索，不做诊疗建议；不回答「我该怎么办」，只回答「书上怎么说」；所有输出可溯源到古籍原文。

## 内容范围

- **中药学**：按全国中医药行业高等教育「十五五」规划教材《中药学》（第 6 版／十二版，钟赣生、杨柏灿主编，中国中医药出版社，2026 年秋季启用）框架整理——总论 7 章 + 各论 21 章 + 附录，教材收药 568 味，逐味建卡（性味归经 / 功效 / 主治 / 用法用量 / 禁忌 / 现代药理 / 个人见解）
- **四大经典**：《黄帝内经》《伤寒论》《金匮要略》《神农本草经》目录级框架，篇目结构完整，内容按需补充

尚未整理的条目以**占位页**呈现，顶部标注「内容整理中」。

## 技术栈

- [VitePress](https://vitepress.dev) 1.6（支持白天／夜间切换 + 自定义首页：毛玻璃 / 步天歌星宿 / 四象图腾）
- [Pagefind](https://pagefind.app) 全文检索，首页与导航栏均可搜索
  - 构建后由 `tools/patch_pagefind_lang.mjs` 固定查询语言（pagefind 索引端与浏览器端的中文分词不一致，会把「黄芪」切成「黄 芪」导致搜不到药名，详见该脚本注释）
- DuckDB 工具链：`data/zhongyao.csv` ↔ `tools/` 查询脚本
- 部署：GitHub push → Vercel 自动构建

## 本地运行

```bash
npm install
npm run dev       # 开发预览（注意：dev 下无 Pagefind 索引，首页搜索需构建产物）
npm run build     # 构建（含全站检索索引）
npm run preview   # 预览构建结果（首页搜索可用）
```

新学习模块需要 Node.js 22.12+。首次安装使用 `npm ci`；不配置登录和数据库时，阅读与自由练习仍可使用。

## 学习模块架构

- `docs/中药学/`：现有药卡内容来源，保留药名、分类、速记、性味归经、功效与主治；学习页面不另编医学答案。
- `content/herb-registry.json`：现有药卡的稳定身份映射，修改路径时更新映射并保留 ID。`tools/herb-study-content.mjs` 将原药卡适配到个人复习接口。
- `content/catalog.json` / `content/study-cards.json`：先前新增的古籍选读练习源文件；不作为主药卡学习数据，不替代现有药卡。
- `shared/`：前后端接口契约与独立 FSRS 调度适配器。算法版本写入每条复习记录。
- `server/auth.ts`：身份提供者接口、GitHub OAuth、服务端会话；不申请仓库访问权限，不保存 GitHub 令牌。
- `server/study-service.ts`：个人学习进度、版本冲突、请求去重、分类重置及私人笔记。
- `server/migrations/`：PostgreSQL 数据库迁移；内容仍在仓库，数据库只存账户和个人数据。
- `api/index.ts`：Vercel 同源 API 入口；`server/dev.ts` 为本地入口。
- `docs/.vitepress/theme/study/`：页面访问 API 的适配层。

正式复习采用四档自评与到期优先队列。自由练习不修改复习计划。用户和卡片的状态只保存一份，分类是筛选视图；重置分类递增版本并清除该分类的调度状态，保留笔记和复习日志。原有药卡仍可在 `/自测/药卡浏览` 中浏览，本地旧记录不会被删除或自动视为新卡的复习记录。

主学习页面沿用原有药卡，一味药对应一张可持续复习的卡，答案直接来自原笔记。现有内容标为 `unverified`（待核对），不能因接入新学习系统就宣称医学内容已审核；没有有效内容的占位卡继续排除。古籍选读中的 `reviewed` 仅表示与固定数字来源核对，不代表医学专家审核，也不代表其他药卡内容已核对。剩余医书内容仍需逐项补齐。

## GitHub 登录与数据库配置

推荐在现有 Vercel 项目通过 Marketplace 连接托管 PostgreSQL（例如 Neon），使用连接池 URL。数据库需自行启用合适的备份与恢复方案；不要把生产数据库连接到 PR 预览环境。

1. 创建数据库，获得 `DATABASE_URL`。不要提交到仓库，也不要粘贴到 issue、PR 或聊天中。
2. 在 GitHub **Settings → Developer settings → OAuth Apps → New OAuth App** 创建应用，正式站点填 `https://yixuebiji.top`，回调填 `https://yixuebiji.top/api/auth/github/callback`。这与开发者用 Git 推送的凭据相互独立。
3. 在 Vercel 的 Production 环境添加 `APP_ORIGIN=https://yixuebiji.top`、`DATABASE_URL`、`GITHUB_CLIENT_ID`、`GITHUB_CLIENT_SECRET`。OAuth 密钥只供服务端读取。
4. 使用仅包含目标数据库连接信息的本地 `.env.local`，执行 `npm run db:migrate`。迁移是显式操作，不在每次网站构建时连接或修改生产数据库。
5. 重新部署并实际验证一次 GitHub 登录、评分、退出及换设备恢复。配置未完成时页面只提供自由练习，不能宣称云端登录已经启用。

本地开发：复制 `.env.example` 为 `.env.local`，使用本地/测试 PostgreSQL，单独创建回调为 `http://localhost:5173/api/auth/github/callback` 的开发 OAuth App。先执行迁移，然后分别运行 `npm run dev:api` 与 `npm run dev`，浏览器访问 `http://localhost:5173`。

不要在生产启用模拟身份。自动化测试通过独立的 `tests/e2e-server.ts` 注入测试身份提供者，正式 API 没有模拟登录开关。

身份扩展契约位于 `shared/auth.ts`，区分 OAuth、扫码挑战、短信验证码和密码凭证，以及登录、身份绑定、账户恢复。当前只实现 GitHub。`GET /api/auth/providers` 只返回实际启用的供应商；`/api/auth/:provider/start` 和 `/callback` 是 OAuth 通用入口。GitHub 恢复入口 `/api/auth/github/recovery` 返回平台自己的恢复地址，本站没有 GitHub 密码。微信、短信和本地密码恢复仍需各自供应商适配与验证，不是已上线功能。恢复必须验证既有绑定身份，并吊销旧会话；不得按新手机号自动合并账户。

## 私有用户数据与管理统计

公开仓库只保存程序、内容和数据库结构，真实用户、复习记录、笔记、会话摘要和登录事件仅存放在私有 PostgreSQL 中。`.env*`、数据库备份和 Vercel 本地配置均被忽略。数据库连接字符串和 OAuth 密钥只能放服务端环境变量，禁止导出到 `docs/public` 或前端环境变量。

服务端 `ADMIN_GITHUB_IDS` 配置管理员的不可变 GitHub 数字 ID（多个用逗号分隔）。未配置则无人具有管理权限。不要使用可改名的用户名判断管理员。

- `/管理/`：管理员页面，普通访客只能看到权限提示。页面代码公开不等于数据公开。
- `GET /api/admin/stats`：累计用户、登录次数、近 7/30 天有登录的用户数与按 UTC 日统计。
- `GET /api/admin/users?page=1`：每页最多 50 个用户，含显示名、注册时间、最近登录和登录次数。

管理接口逐次验证服务端会话和管理员身份，未登录返回 401、非管理员返回 403，响应禁止缓存。统计不包含密码、OAuth token、会话 token、私人笔记、IP 或电话号码。这里的“活跃”以成功登录计，不代表每日打开网站人数。真实数据库不上传 GitHub；管理员权限不是靠隐藏 URL 实现。

参考：[GitHub OAuth 应用创建](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app)、[Vercel 数据库集成](https://vercel.com/docs/marketplace-storage)。

## 自动化验证与发布

```bash
npm run typecheck
npm test                 # 默认使用嵌入式 PostgreSQL；CI 使用隔离的 PostgreSQL 16 schema
npm run content:check    # 稳定 ID、来源、状态、分类和链接校验
npm run build            # 内容生成、VitePress、检索索引、sitemap
npx playwright install chromium
npm run test:e2e         # 完整构建后运行；测试 API 只监听本机
```

CI 在 push/PR 上运行这些检查，使用独立测试数据库，不读取生产 OAuth 密钥。更改应经过功能分支、PR 检查及预览后再合并；在 GitHub 分支规则中将 `verify` 设为必需检查并限制直接推送 `main`，规则需要在仓库设置中配置，提交工作流本身不会自动启用保护。Vercel 仍会为分支创建预览，生产发布绑定 `main`。

数据库更改采用编号迁移，新增迁移不得改写已经发布的历史 SQL。回滚前端版本不会回滚数据库；发布前检查旧版本接口的兼容性。

## 目录结构

```
docs/
  中药学/<分类>/<子类>/<药名>.md   # 每味药一页
  中药学/总论/                     # 药性理论 7 章
  四大经典/<经典>/index.md         # 篇目框架页
data/zhongyao.csv                  # 药卡结构化数据
tools/                             # DuckDB 查询工具
```

## 路线图

- [x] 按模块拆分身份认证、学习进度与私人笔记，支持持久化存储和后续扩展（上线需配置数据库与 OAuth）
- [ ] 补齐教材 568 味药卡内容
- [ ] 四大经典篇目下补充选读与原文摘录
- [ ] 基于 DeepSeek 的「书上怎么说」问答层（回答仅引用站内可溯源内容）

## 说明

内容为个人学习整理；所引古籍原文属公有领域。本站仅供学习参考，不构成任何诊疗建议。
