<template>
  <!-- 星宿背景层：四象二十八宿连线 + 散星 -->
  <svg class="starfield" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <!-- 青龙七宿（东） -->
    <g stroke="#3fa9a0" stroke-opacity=".4" stroke-width="1.2" fill="#bfe8e3" fill-opacity=".8">
      <polyline points="160,380 220,420 200,470 260,500 300,460 330,500 360,470" fill="none"/>
      <circle cx="160" cy="380" r="3"/><circle cx="220" cy="420" r="2.4"/><circle cx="200" cy="470" r="2.8"/>
      <circle cx="260" cy="500" r="2.2"/><circle cx="300" cy="460" r="3"/><circle cx="330" cy="500" r="2.4"/><circle cx="360" cy="470" r="2.8"/>
    </g>
    <!-- 白虎七宿（西） -->
    <g stroke="#c9ced6" stroke-opacity=".4" stroke-width="1.2" fill="#eef1f5" fill-opacity=".8">
      <polyline points="1280,380 1220,420 1240,470 1180,500 1140,460 1110,500 1080,470" fill="none"/>
      <circle cx="1280" cy="380" r="3"/><circle cx="1220" cy="420" r="2.4"/><circle cx="1240" cy="470" r="2.8"/>
      <circle cx="1180" cy="500" r="2.2"/><circle cx="1140" cy="460" r="3"/><circle cx="1110" cy="500" r="2.4"/><circle cx="1080" cy="470" r="2.8"/>
    </g>
    <!-- 朱雀七宿（南） -->
    <g stroke="#c2452e" stroke-opacity=".45" stroke-width="1.2" fill="#e8b3a6" fill-opacity=".8">
      <polyline points="560,770 620,790 680,750 740,800 800,760 860,790 920,750" fill="none"/>
      <circle cx="560" cy="770" r="3"/><circle cx="620" cy="790" r="2.4"/><circle cx="680" cy="750" r="2.8"/>
      <circle cx="740" cy="800" r="2.2"/><circle cx="800" cy="760" r="3"/><circle cx="860" cy="790" r="2.4"/><circle cx="920" cy="750" r="2.8"/>
    </g>
    <!-- 玄武七宿（北） -->
    <g stroke="#5b6d8c" stroke-opacity=".5" stroke-width="1.2" fill="#b9c6dd" fill-opacity=".8">
      <polyline points="560,120 620,140 680,100 740,150 800,110 860,150 920,120" fill="none"/>
      <circle cx="560" cy="120" r="3"/><circle cx="620" cy="140" r="2.4"/><circle cx="680" cy="100" r="2.8"/>
      <circle cx="740" cy="150" r="2.2"/><circle cx="800" cy="110" r="3"/><circle cx="860" cy="150" r="2.4"/><circle cx="920" cy="120" r="2.8"/>
    </g>
    <!-- 散星 -->
    <g fill="#f0ead8" fill-opacity=".7">
      <circle cx="80" cy="200" r="1.8"/><circle cx="420" cy="90" r="1.4"/><circle cx="1050" cy="180" r="2"/>
      <circle cx="1360" cy="640" r="1.6"/><circle cx="240" cy="700" r="1.4"/><circle cx="900" cy="320" r="1.8"/>
      <circle cx="620" cy="430" r="1.3"/><circle cx="1150" cy="620" r="1.6"/><circle cx="520" cy="260" r="1.5"/>
      <circle cx="1310" cy="80" r="1.7"/><circle cx="120" cy="560" r="1.3"/><circle cx="760" cy="220" r="1.5"/>
    </g>
  </svg>

  <!-- 四象背景装饰：左青龙 右白虎 前朱雀 后玄武 -->
  <div class="beasts">
    <a class="beast q-east" style="--q:#3fa9a0" href="/中药学/">
      <svg class="totem" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <circle cx="50" cy="50" r="45" stroke-opacity=".3" stroke-width="1.4" stroke-dasharray="2 5"/>
        <g stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 76 C34 64 30 50 44 46 C54 43 54 30 44 24 C38 20 32 22 30 28"/>
          <path d="M34 26 L40 14 M34 26 L46 16" stroke-width="2"/>
          <path d="M36 30 C30 33 28 38 30 44 M36 30 C42 33 44 38 42 44" stroke-width="1.6"/>
          <circle cx="32" cy="31" r="1.8" fill="currentColor" stroke="none"/>
          <path d="M40 52 C34 55 30 60 32 66" stroke-width="2"/>
          <path d="M40 60 C36 64 34 68 36 74" stroke-width="2"/>
          <path d="M26 72 C20 74 16 70 18 64 C19 60 24 58 27 60" stroke-width="1.6"/>
          <path d="M28 78 C24 82 18 82 16 78" stroke-width="1.6"/>
        </g>
      </svg>
      <h2>青龙</h2>
      <p class="q-sub">东方 · 木 · 春<br>角亢氐房心尾箕</p>
      <p class="q-link">中药学 →</p>
    </a>

    <div class="beast q-west soon" style="--q:#c9ced6">
      <svg class="totem" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <circle cx="50" cy="50" r="45" stroke-opacity=".3" stroke-width="1.4" stroke-dasharray="2 5"/>
        <g stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M50 22 C66 22 78 34 78 50 C78 68 64 80 50 80 C36 80 22 68 22 50 C22 34 34 22 50 22"/>
          <path d="M32 30 L28 16 L42 24" stroke-width="2.4"/>
          <path d="M68 30 L72 16 L58 24" stroke-width="2.4"/>
          <path d="M38 40 h24 M50 36 v16 M38 50 h24" stroke-width="2.2"/>
          <circle cx="35" cy="58" r="2.4" fill="currentColor" stroke="none"/>
          <circle cx="65" cy="58" r="2.4" fill="currentColor" stroke="none"/>
          <path d="M50 63 L45 69 L55 69 Z" stroke-width="2"/>
          <path d="M42 74 Q50 80 58 74" stroke-width="2.2"/>
          <path d="M24 44 Q30 48 26 56 M76 44 Q70 48 74 56" stroke-width="1.8"/>
        </g>
      </svg>
      <h2>白虎</h2>
      <p class="q-sub">西方 · 金 · 秋<br>奎娄胃昴毕觜参</p>
      <p class="q-link">推拿学 · 待补充</p>
    </div>

    <div class="beast q-south soon" style="--q:#c2452e">
      <svg class="totem" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <circle cx="50" cy="50" r="45" stroke-opacity=".3" stroke-width="1.4" stroke-dasharray="2 5"/>
        <g stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M50 62 C44 56 36 52 30 52 C32 42 42 38 50 38 C58 38 68 42 70 52 C64 52 56 56 50 62"/>
          <path d="M34 50 C24 46 14 40 8 32 C16 36 26 40 34 46" stroke-width="2.2"/>
          <path d="M66 50 C76 46 86 40 92 32 C84 36 74 40 66 46" stroke-width="2.2"/>
          <path d="M50 64 L45 84 M50 66 L51 86 M50 66 L57 82" stroke-width="2.2"/>
          <path d="M50 36 C50 30 54 28 60 30" stroke-width="2"/>
          <circle cx="46" cy="44" r="1.8" fill="currentColor" stroke="none"/>
          <path d="M52 40 L60 38 L54 45 Z" stroke-width="1.8"/>
        </g>
      </svg>
      <h2>朱雀</h2>
      <p class="q-sub">南方 · 火 · 夏<br>井鬼柳星张翼轸</p>
      <p class="q-link">方剂学 · 待补充</p>
    </div>

    <a class="beast q-north" style="--q:#5b6d8c" href="/使用指南">
      <svg class="totem" viewBox="0 0 100 100" fill="none" stroke="currentColor">
        <circle cx="50" cy="50" r="45" stroke-opacity=".3" stroke-width="1.4" stroke-dasharray="2 5"/>
        <g stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
          <path d="M28 46 C28 30 38 24 50 24 C62 24 72 30 72 46 C72 62 62 68 50 68 C38 68 28 62 28 46"/>
          <path d="M50 24 C50 46 50 56 50 68" stroke-width="2"/>
          <path d="M33 34 C40 42 60 42 67 34 M30 46 C38 54 62 54 70 46 M33 58 C40 64 60 64 67 58" stroke-width="1.8"/>
          <path d="M50 68 L50 78" stroke-width="2.4"/>
          <path d="M28 52 L18 55 M72 52 L82 55" stroke-width="2.4"/>
          <path d="M34 30 C20 34 16 48 26 56 C34 62 46 60 50 52" stroke-width="2.2"/>
          <path d="M26 56 L14 58 L18 48" stroke-width="2.4"/>
          <circle cx="21" cy="51" r="1.6" fill="currentColor" stroke="none"/>
        </g>
      </svg>
      <h2>玄武</h2>
      <p class="q-sub">北方 · 水 · 冬<br>斗牛女虚危室壁</p>
      <p class="q-link">使用指南 →</p>
    </a>
  </div>

  <!-- 主体内容 -->
  <div class="page">

    <header class="site-header">
      <a class="brand" href="/">
        <span class="brand-seal">溯</span>
        <span class="brand-name">溯本医源</span>
      </a>
      <nav class="site-nav">
        <a href="/中药学/">中药学</a>
        <a href="/公众号/秋肺当时令">公众号</a>
        <a href="/使用指南">使用指南</a>
      </nav>
    </header>

    <main>
      <section class="hero">
        <p class="hero-kicker">个人医学学习整理</p>
        <h1 class="hero-title">溯本<span class="accent">医</span>源</h1>
        <p class="hero-quote">正气存内，邪不可干 · 把知识化为正气</p>
        <div class="hero-actions">
          <a class="btn btn-primary" href="/使用指南">开始学习</a>
          <a class="btn btn-ghost" href="/公众号/秋肺当时令">公众号</a>
        </div>
      </section>

      <section class="quad">
        <a class="quad-card" href="/中药学/">
          <span class="card-icon">🌿</span>
          <h2>中药学</h2>
          <p>四气五味，归经升降</p>
          <span class="card-tag">知识库建设中</span>
        </a>
        <div class="quad-card soon">
          <span class="card-icon">📜</span>
          <h2>方剂学</h2>
          <p>君臣佐使，组方配伍</p>
          <span class="card-tag card-tag-soon">待补充</span>
        </div>
        <div class="quad-card soon">
          <span class="card-icon">🙌</span>
          <h2>推拿学</h2>
          <p>经络腧穴，手法要领</p>
          <span class="card-tag card-tag-soon">待补充</span>
        </div>
        <a class="quad-card" href="/使用指南">
          <span class="card-icon">📖</span>
          <h2>使用指南</h2>
          <p>建库、写笔记、发布全流程</p>
          <span class="card-tag">从零开始</span>
        </a>
      </section>
    </main>

    <footer class="site-footer">
      <p>© 溯本医源 · yixuebiji.top</p>
    </footer>
  </div>
</template>
