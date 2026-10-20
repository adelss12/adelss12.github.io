/*
 * إحصائيات الزوار (GoatCounter) مع استثناء صاحب الموقع
 * يُضاف إلى أي صفحة بسطر واحد قبل </body>:
 *   <script src="https://adelss12.github.io/stats.js" defer></script>
 *
 * - لوحة الإحصائيات: https://adelss12.goatcounter.com
 * - لاستثناء جهازك: افتح أي صفحة وفي آخر الرابط  #ignore-me
 * - لإعادة احتساب جهازك: افتح أي صفحة وفي آخر الرابط  #count-me
 * - لا يجمع أي بيانات شخصية، ولا يعمل عند التجربة على الجهاز (localhost).
 */
(function () {
  'use strict';
  if (window.__adelStats) return;
  window.__adelStats = true;

  var ENDPOINT = 'https://adelss12.goatcounter.com/count';
  var KEY = 'skipgc';

  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); return true; } catch (e) { return false; } }

  function notice(text) {
    function show() {
      var box = document.createElement('div');
      box.textContent = text;
      box.setAttribute('dir', 'rtl');
      box.style.cssText = 'position:fixed;left:50%;top:16px;transform:translateX(-50%);z-index:2147483001;' +
        'background:#0c1628;color:#fff;padding:12px 18px;border-radius:12px;font:15px/1.5 system-ui,sans-serif;' +
        'box-shadow:0 6px 24px rgba(0,0,0,.25);max-width:90vw;text-align:center';
      document.body.appendChild(box);
      setTimeout(function () { box.remove(); }, 4500);
    }
    document.body ? show() : document.addEventListener('DOMContentLoaded', show);
  }

  var hash = location.hash;
  if (hash === '#ignore-me' || hash === '#count-me') {
    var ignore = hash === '#ignore-me';
    var ok = set(ignore ? 't' : null);
    history.replaceState(null, '', location.pathname + location.search);
    notice(!ok ? 'تعذّر الحفظ: المتصفح يمنع التخزين (ربما وضع التصفح الخاص).'
      : ignore ? '✅ تم: زياراتك من هذا الجهاز لن تُحسب في الإحصائيات.'
               : '✅ تم: زياراتك من هذا الجهاز ستُحسب مرة أخرى.');
  }

  var host = location.hostname;
  if (get() === 't' || host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:') return;

  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://gc.zgo.at/count.js';
  s.setAttribute('data-goatcounter', ENDPOINT);
  document.head.appendChild(s);

  // تسجيل نقرات "فتح البرنامج" / "صفحة التنزيل" كأحداث تظهر في اللوحة باسم البرنامج
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.open');
    if (!a || !window.goatcounter || !window.goatcounter.count) return;
    var card = a.closest('.card');
    var name = card && card.querySelector('h2') ? card.querySelector('h2').textContent.trim() : a.href;
    window.goatcounter.count({ path: 'فتح: ' + name, title: name, event: true });
  }, true);
})();
