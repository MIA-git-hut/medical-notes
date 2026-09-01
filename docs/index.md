---
layout: false
head:
  - - link
    - rel: stylesheet
      href: /css/style.css
  - - script
    - src: /js/three.min.js
      defer: true
  - - script
    - src: /js/ink.js
      defer: true
---

<!-- 水墨粒子画布 -->
<canvas id="ink-canvas" aria-hidden="true"></canvas>

<!-- 宣纸底纹 -->
<div class="paper-grain" aria-hidden="true"></div>

<!-- 主体内容 -->
<div class="page" id="page">

  <header class="site-header">
    <a class="brand" href="#">
      <span class="brand-seal">溯</span>
      <span class="brand-name">溯本医源</span>
    </a>
    <nav class="site-nav">
      <a href="#herbs">中药学</a>
      <a href="#formulas">方剂学</a>
      <a href="#tuina">推拿学</a>
    </nav>
    <button id="gyro-btn" class="gyro-btn" type="button" hidden>开启 3D 陀螺仪</button>
  </header>

  <main>
    <section class="hero">
      <p class="hero-kicker">个人医学学习整理</p>
      <h1 class="hero-title">溯本<span class="accent">医</span>源</h1>
      <p class="hero-quote">正气存内，邪不可干<span class="quote-sep">·</span>把知识化为正气</p>
      <div class="hero-actions">
        <a class="btn btn-primary" href="#herbs">开始学习</a>
        <a class="btn btn-ghost" href="#about">关于本站</a>
      </div>
      <p class="hero-hint" id="hero-hint">移动鼠标 · 感受水墨流动</p>
    </section>

    <section class="cards" id="herbs">
      <a class="card" href="#">
        <span class="card-icon">🌿</span>
        <h2>中药学</h2>
        <p>四气五味，归经升降</p>
        <span class="card-tag">知识库建设中</span>
      </a>
      <a class="card" href="#" id="formulas">
        <span class="card-icon">📜</span>
        <h2>方剂学</h2>
        <p>君臣佐使，组方配伍</p>
        <span class="card-tag card-tag-soon">待补充</span>
      </a>
      <a class="card" href="#" id="tuina">
        <span class="card-icon">🙌</span>
        <h2>推拿学</h2>
        <p>经络腧穴，手法要领</p>
        <span class="card-tag card-tag-soon">待补充</span>
      </a>
    </section>

    <section class="about" id="about">
      <h2>关于本站</h2>
      <p>一册长在云端的医学笔记。以传统为纸，以思考为墨，慢慢写，慢慢厚。</p>
    </section>
  </main>

  <footer class="site-footer">
    <p>© 溯本医源 · yixuebiji.top</p>
  </footer>
</div>

<!-- WebGL 不可用时的降级提示 -->
<div class="fallback" id="fallback" hidden>
  <p>当前浏览器不支持 WebGL，已切换为静态水墨背景。</p>
</div>
