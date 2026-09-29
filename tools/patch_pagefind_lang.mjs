/**
 * 构建后修补 pagefind 运行时的查询语言。
 *
 * 背景：pagefind 的索引端（Rust/ICU）与查询端（浏览器 Intl.Segmenter）对中文的
 * 分词结果不一致。例如「黄芪」建索引时是一个词，而 Chrome 的 ICU 会切成「黄 芪」，
 * 查询因此退化为「黄 AND 芪」→ 0 结果（黄芪、桂枝、徐长卿、土茯苓等常见药名都搜不到）。
 *
 * 运行时用 document.documentElement.lang 决定查询语言；把语言设为 en（不对中文分词）
 * 即可让查询原样进入索引：索引仍按 zh-cn 构建（Rust ICU，分词质量好），
 * findIndex('en') 找不到时自动回退到唯一的 zh-cn 索引，查询词则不再被二次切分。
 * 实测：黄芪/桂枝/徐长卿/土茯苓/六神曲 等全部命中。
 *
 * 由 npm run build 在 vitepress build 之后自动执行。
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const FILE = 'docs/.vitepress/dist/pagefind/pagefind.js'
const FROM = 'language:detectLanguage()'
const TO = 'language:"en"'

if (!existsSync(FILE)) {
  console.error(`[patch-pagefind] 找不到 ${FILE}，请先执行 vitepress build`)
  process.exit(1)
}

const src = readFileSync(FILE, 'utf8')
const hits = src.split(FROM).length - 1

if (hits === 0) {
  if (src.includes(TO)) {
    console.log('[patch-pagefind] 已修补过，跳过')
    process.exit(0)
  }
  console.error(`[patch-pagefind] 未找到目标片段 ${FROM}（pagefind 版本可能已更新），请检查后再构建`)
  process.exit(1)
}

writeFileSync(FILE, src.split(FROM).join(TO))
console.log(`[patch-pagefind] 已把查询语言固定为 en（${hits} 处），避免中文查询被二次分词`)
