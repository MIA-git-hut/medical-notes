<template>
  <!-- 星宿背景层：二十八宿按《步天歌》记载的星数形状排列
       东宫青龙（自上而下：角亢氐房心尾箕）｜北宫玄武（自西向东：斗牛女虚危室壁）
       西宫白虎（自上而下：奎娄胃昴毕觜参）｜南宫朱雀（自西向东：井鬼柳星张翼轸） -->
  <svg class="starfield" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <!-- 东方青龙七宿：角二星 亢四星 氐四星 房四星 心三星 尾九星 箕四星 -->
    <g stroke="#3fa9a0" stroke-opacity=".35" stroke-width="1.1" fill="#9fd8d1" fill-opacity=".85">
      <polyline points="152,180 185,310 158,455 190,575 168,658 132,742 228,722" fill="none"/>
      <circle cx="152" cy="180" r="3"/><circle cx="152" cy="212" r="2.6"/><text x="140" y="158" class="su-name">角</text>
      <circle cx="185" cy="300" r="2.6"/><circle cx="173" cy="332" r="2.4"/><circle cx="166" cy="362" r="2.6"/><circle cx="178" cy="388" r="2.4"/><text x="200" y="300" class="su-name">亢</text>
      <circle cx="146" cy="428" r="2.6"/><circle cx="158" cy="452" r="2.4"/><circle cx="172" cy="470" r="2.6"/><circle cx="158" cy="492" r="2.4"/><text x="118" y="438" class="su-name">氐</text>
      <circle cx="192" cy="540" r="2.4"/><circle cx="193" cy="566" r="2.4"/><circle cx="190" cy="592" r="2.6"/><circle cx="197" cy="616" r="2.4"/><text x="212" y="552" class="su-name">房</text>
      <circle cx="150" cy="648" r="2.4"/><circle cx="172" cy="665" r="4" fill="#e8b3a6" fill-opacity=".95"/><circle cx="192" cy="682" r="2.4"/><text x="130" y="648" class="su-name">心</text>
      <circle cx="122" cy="700" r="2.2"/><circle cx="142" cy="712" r="2"/><circle cx="112" cy="730" r="2.4"/><circle cx="132" cy="742" r="2.2"/><circle cx="152" cy="756" r="2"/><circle cx="124" cy="772" r="2.2"/><circle cx="148" cy="782" r="2"/><circle cx="168" cy="790" r="2.4"/><circle cx="144" cy="812" r="2.2"/><text x="98" y="700" class="su-name">尾</text>
      <circle cx="212" cy="700" r="2.4"/><circle cx="228" cy="722" r="2.2"/><circle cx="210" cy="748" r="2.4"/><circle cx="244" cy="742" r="2.4"/><text x="252" y="700" class="su-name">箕</text>
    </g>
    <!-- 北方玄武七宿：斗六星 牛六星 女四星 虚二星 危三星 室二星 壁二星 -->
    <g stroke="#5b6d8c" stroke-opacity=".45" stroke-width="1.1" fill="#aebdd9" fill-opacity=".85">
      <polyline points="322,95 468,92 618,88 711,80 790,90 882,78 970,82" fill="none"/>
      <circle cx="322" cy="92" r="3"/><circle cx="350" cy="78" r="2.4"/><circle cx="346" cy="112" r="2.6"/><circle cx="374" cy="96" r="2.4"/><circle cx="380" cy="122" r="2.6"/><circle cx="408" cy="106" r="2.4"/><text x="322" y="142" class="su-name">斗</text>
      <circle cx="452" cy="80" r="2.6"/><circle cx="472" cy="92" r="2.4"/><circle cx="492" cy="78" r="2.4"/><circle cx="508" cy="100" r="2.6"/><circle cx="526" cy="86" r="2.4"/><circle cx="544" cy="104" r="2.4"/><text x="452" y="126" class="su-name">牛</text>
      <circle cx="602" cy="76" r="2.6"/><circle cx="622" cy="90" r="2.4"/><circle cx="638" cy="78" r="2.4"/><circle cx="656" cy="94" r="2.4"/><text x="602" y="118" class="su-name">女</text>
      <circle cx="710" cy="66" r="2.6"/><circle cx="712" cy="96" r="2.6"/><text x="700" y="44" class="su-name">虚</text>
      <circle cx="776" cy="72" r="2.6"/><circle cx="796" cy="82" r="2.4"/><circle cx="770" cy="100" r="2.4"/><text x="796" y="108" class="su-name">危</text>
      <circle cx="872" cy="66" r="2.6"/><circle cx="892" cy="78" r="2.6"/><text x="880" y="46" class="su-name">室</text>
      <circle cx="962" cy="70" r="2.6"/><circle cx="978" cy="88" r="2.6"/><text x="986" y="66" class="su-name">壁</text>
    </g>
    <!-- 西方白虎七宿：奎十六星 娄三星 胃三星 昴七星 毕八星 觜三星 参七星（伐三星） -->
    <g stroke="#c9ced6" stroke-opacity=".35" stroke-width="1.1" fill="#e4e9f0" fill-opacity=".85">
      <polyline points="1268,178 1290,240 1295,338 1288,420 1342,492 1332,590 1310,745" fill="none"/>
      <circle cx="1262" cy="172" r="2.4"/><circle cx="1282" cy="186" r="2.2"/><circle cx="1258" cy="205" r="2.4"/><circle cx="1286" cy="212" r="2.2"/><circle cx="1272" cy="236" r="2.4"/><circle cx="1296" cy="226" r="2.2"/><circle cx="1276" cy="256" r="2.4"/><circle cx="1292" cy="272" r="2.2"/><text x="1240" y="160" class="su-name">奎</text>
      <circle cx="1302" cy="328" r="2.4"/><circle cx="1282" cy="354" r="2.4"/><circle cx="1322" cy="358" r="2.4"/><text x="1332" y="330" class="su-name">娄</text>
      <circle cx="1272" cy="408" r="2.4"/><circle cx="1302" cy="400" r="2.4"/><circle cx="1290" cy="434" r="2.4"/><text x="1316" y="438" class="su-name">胃</text>
      <circle cx="1332" cy="470" r="2.6"/><circle cx="1348" cy="482" r="2.2"/><circle cx="1336" cy="496" r="2.6"/><circle cx="1352" cy="506" r="2.2"/><circle cx="1326" cy="516" r="2.6"/><circle cx="1342" cy="526" r="2.2"/><circle cx="1358" cy="514" r="2.4"/><text x="1366" y="472" class="su-name">昴</text>
      <circle cx="1262" cy="560" r="2.4"/><circle cx="1286" cy="570" r="2.2"/><circle cx="1272" cy="590" r="2.4"/><circle cx="1300" cy="586" r="2.2"/><circle cx="1286" cy="610" r="2.4"/><circle cx="1312" cy="600" r="2.2"/><circle cx="1296" cy="626" r="2.4"/><circle cx="1322" cy="616" r="2.2"/><text x="1262" y="552" class="su-name">毕</text>
      <circle cx="1336" cy="658" r="2.4"/><circle cx="1356" cy="672" r="2.4"/><circle cx="1342" cy="688" r="2.4"/><text x="1366" y="660" class="su-name">觜</text>
      <circle cx="1292" cy="718" r="2.4"/><circle cx="1318" cy="724" r="2.4"/><circle cx="1306" cy="750" r="2.8"/><circle cx="1332" cy="744" r="2.4"/><circle cx="1300" cy="776" r="2.4"/><circle cx="1326" cy="770" r="2.4"/><circle cx="1316" cy="796" r="2.6"/><text x="1292" y="712" class="su-name">参</text>
      <circle cx="1306" cy="828" r="1.8"/><circle cx="1318" cy="836" r="1.8"/><circle cx="1330" cy="828" r="1.8"/><text x="1306" y="860" class="su-name">伐</text>
    </g>
    <!-- 南方朱雀七宿：井八星 鬼四星 柳八星 星七星 张六星 翼二十二星 轸四星 -->
    <g stroke="#c2452e" stroke-opacity=".4" stroke-width="1.1" fill="#e0a697" fill-opacity=".85">
      <polyline points="336,790 456,788 616,800 786,792 960,790 1245,800 1356,800" fill="none"/>
      <circle cx="336" cy="788" r="2.4"/><circle cx="364" cy="778" r="2.2"/><circle cx="392" cy="794" r="2.4"/><circle cx="420" cy="784" r="2.2"/><circle cx="448" cy="798" r="2.4"/><circle cx="478" cy="784" r="2.2"/><circle cx="508" cy="794" r="2.4"/><circle cx="538" cy="780" r="2.2"/><text x="336" y="770" class="su-name">井</text>
      <circle cx="612" cy="788" r="2.4"/><circle cx="638" cy="788" r="2.4"/><circle cx="612" cy="814" r="2.4"/><circle cx="638" cy="814" r="2.4"/><text x="652" y="804" class="su-name">鬼</text>
      <circle cx="702" cy="778" r="2.2"/><circle cx="722" cy="788" r="2.4"/><circle cx="746" cy="784" r="2.2"/><circle cx="766" cy="798" r="2.4"/><circle cx="790" cy="794" r="2.2"/><circle cx="814" cy="784" r="2.4"/><circle cx="834" cy="798" r="2.2"/><circle cx="856" cy="790" r="2.4"/><text x="702" y="762" class="su-name">柳</text>
      <circle cx="902" cy="774" r="2.2"/><circle cx="922" cy="784" r="2.4"/><circle cx="942" cy="774" r="2.2"/><circle cx="962" cy="790" r="2.6"/><circle cx="982" cy="780" r="2.2"/><circle cx="1002" cy="794" r="2.4"/><circle cx="1022" cy="784" r="2.2"/><text x="902" y="754" class="su-name">星</text>
      <circle cx="1062" cy="788" r="2.2"/><circle cx="1082" cy="800" r="2.4"/><circle cx="1102" cy="784" r="2.2"/><circle cx="1122" cy="800" r="2.4"/><circle cx="1142" cy="790" r="2.2"/><circle cx="1162" cy="806" r="2.4"/><text x="1062" y="770" class="su-name">张</text>
      <circle cx="1182" cy="780" r="2"/><circle cx="1202" cy="798" r="2.2"/><circle cx="1222" cy="784" r="2"/><circle cx="1242" cy="802" r="2.2"/><circle cx="1262" cy="790" r="2"/><circle cx="1282" cy="804" r="2.2"/><circle cx="1208" cy="818" r="2"/><circle cx="1232" cy="818" r="2"/><circle cx="1256" cy="818" r="2"/><circle cx="1280" cy="818" r="2"/><circle cx="1300" cy="800" r="2.2"/><circle cx="1312" cy="818" r="2"/><text x="1182" y="762" class="su-name">翼</text>
      <circle cx="1342" cy="780" r="2.4"/><circle cx="1362" cy="798" r="2.4"/><circle cx="1346" cy="814" r="2.2"/><circle cx="1372" cy="810" r="2.4"/><text x="1380" y="780" class="su-name">轸</text>
    </g>
    <!-- 散星 -->
    <g fill="#f0ead8" fill-opacity=".5">
      <circle cx="80" cy="200" r="1.6"/><circle cx="1050" cy="180" r="1.8"/><circle cx="1360" cy="640" r="1.4"/>
      <circle cx="240" cy="700" r="1.2"/><circle cx="900" cy="320" r="1.6"/><circle cx="620" cy="430" r="1.2"/>
      <circle cx="1150" cy="620" r="1.4"/><circle cx="520" cy="260" r="1.3"/><circle cx="1310" cy="80" r="1.5"/>
      <circle cx="120" cy="560" r="1.2"/><circle cx="760" cy="220" r="1.3"/><circle cx="60" cy="820" r="1.4"/>
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
