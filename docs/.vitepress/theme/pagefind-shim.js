/**
 * pagefind 的搜索结果分两类：命中正文的（带 weighted_locations / sub_results），
 * 和只命中标题元数据的（两者都是空数组）。vitepress-plugin-pagefind 的导航弹层
 * 只渲染前者，于是「枇杷叶」这类被索引端 ICU 拆成「枇杷 + 叶」的药名虽然能被
 * pagefind 匹配到（返回结果、但没有位置信息），弹层里却显示「空空如也」。
 *
 * 这里拦截 window.__pagefind__，给无位置信息的结果补一个页面级锚点，
 * 让插件按正常路径渲染出标题与摘要。仅影响展示，不改变匹配与排序。
 */

const PAGE_START = 0

function wrapResult(result) {
  const original = result.data.bind(result)
  result.data = async () => {
    const data = await original()
    if (!(data.weighted_locations || []).length) {
      data.weighted_locations = [{ location: PAGE_START, weight: 0 }]
      data.sub_results = [
        {
          url: data.url,
          locations: [PAGE_START],
          title: (data.meta && data.meta.title) || '',
        },
      ]
    }
    return data
  }
  return result
}

function wrapResponse(res) {
  if (!res || !Array.isArray(res.results)) return res
  const results = res.results.map(wrapResult)
  const clone = {}
  for (const key of Object.keys(res)) clone[key] = res[key]
  clone.results = results
  return clone
}

function wrapModule(mod) {
  // 模块命名空间对象不可写，且 Object.create 派生对象上的赋值会被
  // 继承来的不可写属性挡掉，因此只能用 Proxy 覆盖这两个入口
  return new Proxy(mod, {
    get(target, key) {
      if (key === 'search') return async (term, opts) => wrapResponse(await target.search(term, opts))
      if (key === 'debouncedSearch')
        return async (term, opts, delay) => wrapResponse(await target.debouncedSearch(term, opts, delay))
      return Reflect.get(target, key)
    },
  })
}

export function installPagefindShim() {
  if (typeof window === 'undefined' || window.__pagefindShimInstalled) return
  window.__pagefindShimInstalled = true
  let current = null
  Object.defineProperty(window, '__pagefind__', {
    configurable: true,
    get: () => current,
    set(mod) {
      current = mod ? wrapModule(mod) : mod
    },
  })
}
