/* ============================================================
 * 溯本医源 · 水墨粒子流
 * Three.js r128 · 自定义着色器点精灵 · 流场 + 指针涡旋 + 落墨涟漪
 * 兼容 iOS / Android（Pointer Events + 陀螺仪视差 + DPR 限制）
 * ============================================================ */
(function () {
  'use strict';

  var canvas = document.getElementById('ink-canvas');
  var fallback = document.getElementById('fallback');

  /* ---------- WebGL 检测，失败则降级为静态背景 ---------- */
  function webglOK() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext &&
        (c.getContext('webgl') || c.getContext('experimental-webgl')));
    } catch (e) { return false; }
  }
  if (!window.THREE || !webglOK()) {
    if (fallback) fallback.hidden = false;
    canvas.style.display = 'none';
    return;
  }

  /* ---------- 设备判定与性能预算 ---------- */
  var isCoarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  var smallScreen = Math.min(window.innerWidth, window.innerHeight) < 740;
  var isMobile = isCoarse || smallScreen;
  var PARTICLE_COUNT = isMobile ? 3600 : 10000;
  var DPR = Math.min(window.devicePixelRatio || 1, isMobile ? 1.8 : 2);
  var reducedMotion = window.matchMedia &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var TIME_SCALE = reducedMotion ? 0.25 : 1.0;

  /* 触摸设备把提示语改掉 */
  var hint = document.getElementById('hero-hint');
  if (hint && isCoarse) hint.textContent = '触摸屏幕 · 感受水墨流动';

  /* ---------- 渲染器 / 场景 / 相机 ---------- */
  var renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    alpha: true,
    antialias: false,           // 点精灵自带柔边，省掉 MSAA 换性能
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(DPR);
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(
    60, window.innerWidth / window.innerHeight, 1, 1200);
  camera.position.set(0, 0, 240);

  /* 由相机参数推 z=0 平面的可视范围，作为粒子世界边界 */
  function visibleBounds() {
    var halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    var halfW = halfH * camera.aspect;
    return { w: halfW * 1.2, h: halfH * 1.2 };
  }
  var bounds = visibleBounds();

  /* ---------- 粒子数据（CPU 侧） ---------- */
  var N = PARTICLE_COUNT;
  var pos = new Float32Array(N * 3);   // 位置（直接喂给 GPU）
  var vel = new Float32Array(N * 3);   // 速度
  var col = new Float32Array(N * 3);   // 颜色
  var size = new Float32Array(N);      // 基础尺寸
  var seed = new Float32Array(N);      // 边缘不规则种子
  var baseAlpha = new Float32Array(N); // 基础透明度
  var alphaAttr = new Float32Array(N); // 每帧计算后上传

  var INK = new THREE.Color(0x1c1a17);
  var INK_WARM = new THREE.Color(0x3a352c);
  var CINNABAR = new THREE.Color(0x9e2b22); // 朱砂，点睛
  var tmpColor = new THREE.Color();

  function resetParticle(i, anywhere) {
    var i3 = i * 3;
    pos[i3]     = (Math.random() * 2 - 1) * bounds.w;
    pos[i3 + 1] = (Math.random() * 2 - 1) * bounds.h;
    pos[i3 + 2] = (Math.random() * 2 - 1) * 90;
    vel[i3] = vel[i3 + 1] = vel[i3 + 2] = 0;
    // 2.5% 朱砂，其余墨色系
    if (Math.random() < 0.025) tmpColor.copy(CINNABAR);
    else tmpColor.copy(INK).lerp(INK_WARM, Math.random());
    col[i3] = tmpColor.r; col[i3 + 1] = tmpColor.g; col[i3 + 2] = tmpColor.b;
    // 少量大而淡的"晕染" + 多数细碎的"墨点"，透明度整体压低
    var big = Math.random() < 0.18;
    size[i] = big
      ? (isMobile ? 7.0 : 9.0) + Math.random() * 10.0
      : (isMobile ? 1.8 : 2.2) + Math.random() * Math.random() * 5.0;
    seed[i] = Math.random() * 1000;
    baseAlpha[i] = big
      ? 0.03 + Math.random() * 0.06
      : 0.05 + Math.random() * Math.random() * 0.22;
    alphaAttr[i] = baseAlpha[i];
  }
  for (var i = 0; i < N; i++) resetParticle(i, true);

  /* ---------- 几何体与着色器 ---------- */
  var geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphaAttr, 1).setUsage(THREE.DynamicDrawUsage));

  var material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
    vertexShader: [
      'attribute vec3 aColor;',
      'attribute float aSize;',
      'attribute float aSeed;',
      'attribute float aAlpha;',
      'varying vec3 vColor;',
      'varying float vSeed;',
      'varying float vAlpha;',
      'void main() {',
      '  vColor = aColor; vSeed = aSeed; vAlpha = aAlpha;',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  gl_PointSize = aSize * (300.0 / -mv.z);',
      '  gl_Position = projectionMatrix * mv;',
      '}'
    ].join('\n'),
    fragmentShader: [
      'varying vec3 vColor;',
      'varying float vSeed;',
      'varying float vAlpha;',
      'void main() {',
      '  vec2 uv = gl_PointCoord - 0.5;',
      '  float d = length(uv);',
      '  float ang = atan(uv.y, uv.x);',
      // 墨滴边缘的不规则晕染
      '  float edge = 0.5 + 0.055 * sin(ang * 7.0 + vSeed)',
      '                  + 0.035 * sin(ang * 13.0 + vSeed * 1.7);',
      '  float a = smoothstep(edge, edge - 0.30, d) * vAlpha;',
      // 中心略浓，模拟积墨
      '  a *= 1.0 + 0.5 * smoothstep(0.25, 0.0, d);',
      '  if (a < 0.012) discard;',
      '  gl_FragColor = vec4(vColor, a);',
      '}'
    ].join('\n')
  });

  scene.add(new THREE.Points(geo, material));

  /* ---------- 涟漪（点击/触摸落墨） ---------- */
  var ripples = [];
  var rippleMat = new THREE.MeshBasicMaterial({
    color: 0x1c1a17, transparent: true, opacity: 0.35,
    side: THREE.DoubleSide, depthTest: false
  });
  function spawnRipple(x, y) {
    var m = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.15, 48), rippleMat.clone());
    m.position.set(x, y, 0);
    m.userData.life = 1.0;
    scene.add(m);
    ripples.push(m);
  }
  function updateRipples(dt) {
    for (var i = ripples.length - 1; i >= 0; i--) {
      var m = ripples[i];
      m.userData.life -= dt * 1.6;
      var k = 1.0 - m.userData.life;
      m.scale.setScalar(1 + k * 60);
      m.material.opacity = 0.32 * m.userData.life;
      if (m.userData.life <= 0) {
        scene.remove(m);
        m.geometry.dispose(); m.material.dispose();
        ripples.splice(i, 1);
      }
    }
  }

  /* ---------- 指针交互（鼠标 / 触摸统一走 Pointer Events） ---------- */
  var pointer = {
    x: 9999, y: 9999,        // 世界坐标（z=0 平面）
    px: 9999, py: 9999,      // 上一帧
    speed: 0,
    active: false,
    ndc: new THREE.Vector2(0, 0)
  };
  var raycaster = new THREE.Raycaster();
  var planeZ = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  var hitPoint = new THREE.Vector3();

  function toWorld(clientX, clientY) {
    pointer.ndc.set(
      (clientX / window.innerWidth) * 2 - 1,
      -(clientY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(pointer.ndc, camera);
    return raycaster.ray.intersectPlane(planeZ, hitPoint);
  }

  function onMove(e) {
    var p = toWorld(e.clientX, e.clientY);
    if (!p) return;
    if (!pointer.active) { pointer.px = p.x; pointer.py = p.y; }
    pointer.x = p.x; pointer.y = p.y;
    pointer.active = true;
  }
  function onDown(e) {
    onMove(e);
    spawnRipple(pointer.x, pointer.y);
    inkBurst(pointer.x, pointer.y);
  }
  function onLeave() { pointer.active = false; pointer.x = pointer.y = 9999; }

  window.addEventListener('pointermove', onMove, { passive: true });
  window.addEventListener('pointerdown', onDown, { passive: true });
  window.addEventListener('pointercancel', onLeave, { passive: true });
  document.addEventListener('mouseleave', onLeave);

  /* 落墨：随机抽 6% 粒子甩到落点四周炸开 */
  function inkBurst(x, y) {
    var count = Math.floor(N * 0.06);
    for (var k = 0; k < count; k++) {
      var i = Math.floor(Math.random() * N);
      var i3 = i * 3;
      var ang = Math.random() * Math.PI * 2;
      var r = Math.random() * 6;
      pos[i3] = x + Math.cos(ang) * r;
      pos[i3 + 1] = y + Math.sin(ang) * r;
      pos[i3 + 2] = (Math.random() - 0.5) * 30;
      var sp = 2 + Math.random() * 9;
      vel[i3] = Math.cos(ang) * sp;
      vel[i3 + 1] = Math.sin(ang) * sp;
      vel[i3 + 2] = (Math.random() - 0.5) * 2;
      alphaAttr[i] = Math.min(1, baseAlpha[i] + 0.5);
    }
  }

  /* ---------- 陀螺仪视差（移动端 3D 感） ---------- */
  var gyro = { enabled: false, x: 0, y: 0 };
  var gyroBtn = document.getElementById('gyro-btn');

  function gyroAvailable() {
    return 'DeviceOrientationEvent' in window && isCoarse;
  }
  if (gyroAvailable() && gyroBtn) {
    gyroBtn.hidden = false;
    gyroBtn.addEventListener('click', function () {
      var enable = function () {
        if (gyro.enabled) return;
        gyro.enabled = true;
        gyroBtn.textContent = '陀螺仪已开启';
        window.addEventListener('deviceorientation', function (e) {
          if (e.gamma === null) return;
          // gamma: 左右倾 [-90,90]  beta: 前后倾 [-180,180]
          gyro.x = THREE.MathUtils.clamp(e.gamma / 45, -1, 1);
          gyro.y = THREE.MathUtils.clamp((e.beta - 45) / 45, -1, 1);
        });
      };
      // iOS 13+ 需要显式申请权限
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
          .then(function (state) { if (state === 'granted') enable(); })
          .catch(function () {});
      } else {
        enable(); // Android / 旧 iOS 直接可用
      }
    });
  }

  /* ---------- 流场（廉价三角噪声模拟卷曲墨流） ---------- */
  var FT = 0; // 流场时间
  function flowX(x, y, z) {
    var s = 0.0062;
    return Math.sin(y * s * 1.7 + FT * 0.30) + Math.cos(z * s * 2.1 - FT * 0.23);
  }
  function flowY(x, y, z) {
    var s = 0.0062;
    return Math.sin(z * s * 1.3 - FT * 0.27) + Math.cos(x * s * 1.9 + FT * 0.19);
  }
  function flowZ(x, y, z) {
    var s = 0.0062;
    return (Math.sin(x * s * 1.5 + FT * 0.21) + Math.cos(y * s * 1.1 + FT * 0.31)) * 0.5;
  }

  /* ---------- 相机视差目标 ---------- */
  var camTarget = { x: 0, y: 0 };

  /* ---------- 主循环 ---------- */
  var clock = new THREE.Clock();
  var running = true;
  var rafId = 0;
  var INFLUENCE = isMobile ? 46 : 60;   // 指针影响半径
  var introDone = false;

  function tick() {
    rafId = requestAnimationFrame(tick);
    var dt = Math.min(clock.getDelta(), 0.05) * TIME_SCALE;
    FT += dt;

    /* 入场落墨 */
    if (!introDone) {
      introDone = true;
      setTimeout(function () { inkBurst(0, 0); spawnRipple(0, 0); }, 350);
    }

    /* 指针速度（用于推动墨迹） */
    if (pointer.active) {
      var dx = pointer.x - pointer.px, dy = pointer.y - pointer.py;
      pointer.speed = Math.min(Math.sqrt(dx * dx + dy * dy) / Math.max(dt, 0.001), 260);
      pointer.px += dx * 0.55; pointer.py += dy * 0.55; // 拖尾跟随，带惯性
    } else {
      pointer.speed *= 0.9;
    }

    /* 相机视差：指针优先，其次陀螺仪 */
    if (gyro.enabled) {
      camTarget.x = gyro.x * 26;
      camTarget.y = -gyro.y * 20;
    } else {
      camTarget.x = pointer.ndc.x * 22;
      camTarget.y = pointer.ndc.y * 16;
    }
    camera.position.x += (camTarget.x - camera.position.x) * 0.045;
    camera.position.y += (camTarget.y - camera.position.y) * 0.045;
    camera.lookAt(0, 0, 0);

    /* 粒子更新 */
    var R = INFLUENCE, R2 = R * R;
    var hasP = pointer.active;
    var px = pointer.x, py = pointer.y;
    var ps = pointer.speed;

    for (var i = 0; i < N; i++) {
      var i3 = i * 3;
      var x = pos[i3], y = pos[i3 + 1], z = pos[i3 + 2];

      // 1) 流场引导（让速度朝流场方向缓动）
      var fx = flowX(x, y, z), fy = flowY(x, y, z), fz = flowZ(x, y, z);
      vel[i3]     += (fx * 0.55 - vel[i3]) * 0.035;
      vel[i3 + 1] += (fy * 0.55 - vel[i3 + 1]) * 0.035;
      vel[i3 + 2] += (fz * 0.30 - vel[i3 + 2]) * 0.035;

      // 2) 指针涡旋：径向外推 + 切向搅动 + 提亮
      if (hasP) {
        var ox = x - px, oy = y - py;
        var d2 = ox * ox + oy * oy;
        if (d2 < R2 && d2 > 0.01) {
          var d = Math.sqrt(d2);
          var fall = 1 - d / R;
          fall *= fall;
          var push = (0.10 + ps * 0.004) * fall;
          vel[i3]     += (ox / d) * push * 3.2 - (oy / d) * push * 2.2;
          vel[i3 + 1] += (oy / d) * push * 3.2 + (ox / d) * push * 2.2;
          var boost = baseAlpha[i] + fall * 0.5;
          alphaAttr[i] += (Math.min(boost, 1) - alphaAttr[i]) * 0.4;
        } else {
          alphaAttr[i] += (baseAlpha[i] - alphaAttr[i]) * 0.06;
        }
      } else {
        alphaAttr[i] += (baseAlpha[i] - alphaAttr[i]) * 0.06;
      }

      // 3) 位置积分
      x += vel[i3] * dt * 60 * 0.16;
      y += vel[i3 + 1] * dt * 60 * 0.16;
      z += vel[i3 + 2] * dt * 60 * 0.16;

      // 4) 出界回绕（墨流不息）
      if (x >  bounds.w) x = -bounds.w; else if (x < -bounds.w) x =  bounds.w;
      if (y >  bounds.h) y = -bounds.h; else if (y < -bounds.h) y =  bounds.h;
      if (z >  90) z = -90; else if (z < -90) z = 90;

      pos[i3] = x; pos[i3 + 1] = y; pos[i3 + 2] = z;
    }

    geo.attributes.position.needsUpdate = true;
    geo.attributes.aAlpha.needsUpdate = true;

    updateRipples(dt);
    renderer.render(scene, camera);
  }

  /* ---------- 窗口自适应 ---------- */
  var resizeTimer = 0;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      bounds = visibleBounds();
    }, 120);
  });

  /* ---------- 切后台暂停，省电 ---------- */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      running = false;
      cancelAnimationFrame(rafId);
    } else if (!running) {
      running = true;
      clock.getDelta();
      tick();
    }
  });

  tick();
})();
