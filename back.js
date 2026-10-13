/*
 * زر الرجوع إلى "برامج عادل"
 * يُضاف إلى أي برنامج بسطر واحد قبل </body>:
 *   <script src="https://adelss12.github.io/back.js" defer></script>
 *
 * - زر دائري عائم يمكن سحبه لأي مكان، ويلتصق بأقرب حافة ويحفظ مكانه.
 * - يحترم حواف الآيفون (النوتش والشريط السفلي).
 * - لا يظهر في الصفحة الرئيسية نفسها.
 */
(function () {
  'use strict';
  var HOME = 'https://adelss12.github.io/';
  if (window.__adelBack) return;
  window.__adelBack = true;

  var path = location.pathname.replace(/\/+$/, '');
  if (location.hostname === 'adelss12.github.io' && (path === '' || path === '/index.html')) return;

  var KEY = 'adelBackPos:' + (path.split('/')[1] || 'app');
  var SIZE = 46;
  var MARGIN = 8;

  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  ready(function () {
    var css = document.createElement('style');
    css.textContent =
      '#adel-back{position:fixed;z-index:2147483000;width:' + SIZE + 'px;height:' + SIZE + 'px;' +
      'border-radius:50%;border:1px solid rgba(255,255,255,.35);padding:0;margin:0;' +
      'display:flex;align-items:center;justify-content:center;cursor:pointer;' +
      'background:rgba(12,22,40,.72);color:#fff;' +
      '-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);' +
      'box-shadow:0 6px 18px rgba(0,0,0,.28);touch-action:none;user-select:none;-webkit-user-select:none;' +
      '-webkit-tap-highlight-color:transparent;opacity:.8;transition:opacity .2s,transform .15s,left .25s,top .25s;}' +
      '#adel-back:hover,#adel-back:focus-visible{opacity:1}' +
      '#adel-back:active{transform:scale(.92)}' +
      '#adel-back.dragging{transition:none;opacity:1}' +
      '#adel-back:focus-visible{outline:3px solid #36a3ff;outline-offset:2px}' +
      '#adel-back svg{width:22px;height:22px;pointer-events:none}' +
      '@media print{#adel-back{display:none}}';
    document.head.appendChild(css);

    var btn = document.createElement('button');
    btn.id = 'adel-back';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'الرجوع إلى صفحة البرامج');
    btn.title = 'الرجوع إلى برامج عادل';
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5"/></svg>';
    document.body.appendChild(btn);

    // حواف الآيفون الآمنة
    var probe = document.createElement('div');
    probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;' +
      'top:env(safe-area-inset-top,0px);bottom:env(safe-area-inset-bottom,0px);' +
      'left:env(safe-area-inset-left,0px);right:env(safe-area-inset-right,0px);';
    document.body.appendChild(probe);
    function safe() {
      var cs = getComputedStyle(probe);
      return {
        t: parseFloat(cs.top) || 0, b: parseFloat(cs.bottom) || 0,
        l: parseFloat(cs.left) || 0, r: parseFloat(cs.right) || 0
      };
    }

    function load() {
      try { var v = JSON.parse(localStorage.getItem(KEY)); if (v && typeof v.y === 'number') return v; } catch (e) {}
      return { side: 'left', y: 0.42 }; // افتراضيًا: منتصف الحافة اليسرى تقريبًا
    }
    function save(p) { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch (e) {} }

    var pos = load();
    function place() {
      var s = safe();
      var W = window.innerWidth, H = window.innerHeight;
      var minY = s.t + MARGIN, maxY = H - s.b - SIZE - MARGIN;
      var y = Math.min(maxY, Math.max(minY, pos.y * H));
      var x = pos.side === 'right' ? W - s.r - SIZE - MARGIN : s.l + MARGIN;
      btn.style.left = x + 'px';
      btn.style.top = y + 'px';
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('orientationchange', function () { setTimeout(place, 300); });

    // السحب
    var start = null, moved = false;
    btn.addEventListener('pointerdown', function (e) {
      start = { x: e.clientX, y: e.clientY, l: btn.offsetLeft, t: btn.offsetTop };
      moved = false;
      try { btn.setPointerCapture(e.pointerId); } catch (err) {}
    });
    btn.addEventListener('pointermove', function (e) {
      if (!start) return;
      var dx = e.clientX - start.x, dy = e.clientY - start.y;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 8) return;
      moved = true;
      btn.classList.add('dragging');
      btn.style.left = (start.l + dx) + 'px';
      btn.style.top = (start.t + dy) + 'px';
    });
    function end() {
      if (!start) return;
      start = null;
      btn.classList.remove('dragging');
      if (moved) {
        var cx = btn.offsetLeft + SIZE / 2;
        pos = { side: cx > window.innerWidth / 2 ? 'right' : 'left', y: btn.offsetTop / window.innerHeight };
        save(pos);
        place();
      }
    }
    btn.addEventListener('pointerup', end);
    btn.addEventListener('pointercancel', end);

    btn.addEventListener('click', function (e) {
      if (moved) { e.preventDefault(); moved = false; return; }
      location.href = HOME;
    });
  });
})();
