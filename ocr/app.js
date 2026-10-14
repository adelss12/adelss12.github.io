// استخراج النص — قراءة PDF المصوّر والصور بالعربي والإنجليزي داخل المتصفح.
// pdf.js يحوّل كل صفحة إلى صورة بدقة عالية، ثم يقرأها Tesseract.

import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';

const $ = (id) => document.getElementById(id);
const els = {
  file: $('file'), drop: $('drop'), lang: $('lang'), layout: $('layout'), enhance: $('enhance'),
  pickPanel: $('pickPanel'), statusPanel: $('statusPanel'), statusText: $('statusText'),
  statusSub: $('statusSub'), bar: $('bar'), cancelBtn: $('cancelBtn'),
  resultPanel: $('resultPanel'), pages: $('pages'), summary: $('summary'),
  copyAll: $('copyAll'), dlTxt: $('dlTxt'), dlDoc: $('dlDoc'), newBtn: $('newBtn'), toast: $('toast'),
};

const TARGET_DPI = 300;          // دقة المسح المثالية لـ OCR
const MAX_SIDE = 4200;           // حد أعلى للبكسل حتى لا ينفد الذاكرة على الجوال

let worker = null;
let workerLang = '';
let cancelled = false;
let busy = false;
let currentName = 'النص';
/** @type {{label:string, source:object, rotation:number, text:string, conf:number, el?:HTMLElement}[]} */
let pages = [];

// ---------- محرك القراءة ----------

async function getWorker(lang) {
  if (worker && workerLang === lang) return worker;
  if (worker) { await worker.terminate(); worker = null; }
  setStatus('جارٍ تجهيز محرك القراءة…', 'أول مرة فقط: تنزيل ملفات اللغة (قد يستغرق دقيقة)');
  worker = await Tesseract.createWorker(lang.split('+'), 1, {
    logger: (m) => {
      if (m.status === 'recognizing text') setProgress(currentPageBase + m.progress * currentPageShare);
      else if (/loading|initializ/.test(m.status) && typeof m.progress === 'number') {
        els.statusSub.textContent = 'تنزيل ملفات اللغة وتجهيزها… ' + Math.round(m.progress * 100) + '%';
      }
    },
  });
  workerLang = lang;
  return worker;
}

let currentPageBase = 0;
let currentPageShare = 1;

async function recognizeCanvas(canvas) {
  const w = await getWorker(els.lang.value);
  await w.setParameters({
    tessedit_pageseg_mode: els.layout.value,
    preserve_interword_spaces: '1',
    user_defined_dpi: String(TARGET_DPI),
  });
  const { data } = await w.recognize(canvas);
  return { text: cleanText(data.text), conf: Math.round(data.confidence || 0) };
}

function cleanText(t) {
  return (t || '')
    .replace(/\r/g, '')
    .split('\n').map((l) => l.replace(/[ \t]+$/g, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------- تحويل الصفحات إلى صور ----------

async function renderPdfPage(pdf, pageNo, rotation) {
  const page = await pdf.getPage(pageNo);
  const base = page.getViewport({ scale: 1, rotation: (page.rotate + rotation) % 360 });
  const scale = Math.min(TARGET_DPI / 72, MAX_SIDE / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale, rotation: (page.rotate + rotation) % 360 });
  const canvas = document.createElement('canvas');
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport }).promise;
  page.cleanup();
  return canvas;
}

async function renderImage(file, rotation) {
  const bmp = await createImageBitmap(file);
  // الصور الصغيرة تُكبَّر، لأن Tesseract يقرأ الحروف الصغيرة بشكل أسوأ
  const longSide = Math.max(bmp.width, bmp.height);
  const scale = longSide < 2000 ? Math.min(2, 2400 / longSide) : Math.min(1, MAX_SIDE / longSide);
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const swap = rotation === 90 || rotation === 270;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? h : w;
  canvas.height = swap ? w : h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, -w / 2, -h / 2, w, h);
  bmp.close && bmp.close();
  return canvas;
}

// تحسين الصورة: تدرج رمادي + شد التباين، يفيد مع المسح الباهت أو الأصفر
function enhance(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0;
    d[i] = g;
    hist[g]++;
  }
  const total = d.length / 4;
  let lo = 0, hi = 255, acc = 0;
  for (; lo < 255; lo++) { acc += hist[lo]; if (acc > total * 0.01) break; }
  acc = 0;
  for (; hi > 0; hi--) { acc += hist[hi]; if (acc > total * 0.05) break; }
  if (hi - lo < 40) { lo = 0; hi = 255; }
  const range = hi - lo;
  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) lut[v] = ((v - lo) * 255) / range;
  for (let i = 0; i < d.length; i += 4) {
    const v = lut[d[i]];
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

function thumbnail(canvas) {
  const s = 220 / Math.max(canvas.width, canvas.height);
  const t = document.createElement('canvas');
  t.width = Math.round(canvas.width * s);
  t.height = Math.round(canvas.height * s);
  t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
  return t.toDataURL('image/jpeg', 0.7);
}

function release(canvas) { canvas.width = 0; canvas.height = 0; }

// ---------- التشغيل ----------

async function handleFiles(fileList) {
  const files = Array.from(fileList || []).filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name) || f.type.startsWith('image/'));
  if (!files.length) { toast('اختر ملف PDF أو صورة'); return; }
  if (busy) return;
  busy = true; cancelled = false;
  pages = [];
  els.pages.innerHTML = '';
  currentName = files.length === 1 ? files[0].name.replace(/\.[^.]+$/, '') : 'النص المستخرج';
  els.pickPanel.hidden = true;
  els.resultPanel.hidden = false;
  els.statusPanel.hidden = false;
  setProgress(0);

  try {
    // 1) جمع كل الصفحات
    setStatus('جارٍ فتح الملف…', '');
    for (const f of files) {
      if (f.type.startsWith('image/')) {
        pages.push({ label: files.length > 1 ? f.name : 'الصورة', source: { kind: 'image', file: f }, rotation: 0, text: '', conf: 0 });
      } else {
        const pdf = await pdfjsLib.getDocument({ data: await f.arrayBuffer() }).promise;
        for (let i = 1; i <= pdf.numPages; i++) {
          const label = (files.length > 1 ? f.name + ' · ' : '') + 'صفحة ' + i;
          pages.push({ label, source: { kind: 'pdf', pdf, pageNo: i }, rotation: 0, text: '', conf: 0 });
        }
      }
    }
    pages.forEach((p) => els.pages.appendChild(pageCard(p)));

    // 2) قراءة الصفحات بالترتيب
    for (let i = 0; i < pages.length; i++) {
      if (cancelled) break;
      currentPageBase = i / pages.length;
      currentPageShare = 1 / pages.length;
      setStatus(`جارٍ قراءة ${pages[i].label} من ${pages.length}`, 'الصفحة الواحدة تأخذ عادة بين 5 و 20 ثانية');
      await processPage(pages[i]);
      setProgress((i + 1) / pages.length);
    }
    finish();
  } catch (err) {
    console.error(err);
    if (!cancelled) {
      toast(/password/i.test(String(err && err.message)) ? 'الملف محمي بكلمة مرور' : 'تعذر قراءة الملف. تأكد من اتصال الإنترنت في أول استخدام.');
    }
    finish();
  }
}

async function processPage(p) {
  p.el.classList.add('working');
  p.el.querySelector('.page-text').value = '';
  p.el.querySelector('.conf').textContent = 'جارٍ القراءة…';
  const canvas = p.source.kind === 'pdf'
    ? await renderPdfPage(p.source.pdf, p.source.pageNo, p.rotation)
    : await renderImage(p.source.file, p.rotation);
  p.el.querySelector('img').src = thumbnail(canvas);
  if (cancelled) { release(canvas); return; }
  if (els.enhance.checked) enhance(canvas);
  const r = await recognizeCanvas(canvas);
  release(canvas);
  p.text = r.text;
  p.conf = r.conf;
  updateCard(p);
}

function finish() {
  busy = false;
  els.statusPanel.hidden = true;
  const done = pages.filter((p) => p.text).length;
  const chars = pages.reduce((n, p) => n + p.text.length, 0);
  els.summary.textContent = cancelled
    ? `توقفت القراءة · ${done} من ${pages.length} صفحة`
    : `${pages.length} صفحة · ${chars.toLocaleString('ar-SA')} حرف`;
  if (!cancelled && pages.length && !chars) toast('لم يُعثر على نص. جرّب تدوير الصفحة أو إيقاف تحسين الصورة.');
}

// ---------- الواجهة ----------

function pageCard(p) {
  const el = document.createElement('article');
  el.className = 'page';
  el.innerHTML = `
    <div class="page-side">
      <img alt="" width="110" height="150">
      <button class="btn ghost small rotate" type="button" title="تدوير الصفحة 90° ثم إعادة قراءتها">↻ تدوير وإعادة</button>
    </div>
    <div class="page-main">
      <div class="page-head">
        <strong></strong>
        <span class="conf muted">بالانتظار</span>
        <button class="btn ghost small copy" type="button">نسخ</button>
      </div>
      <textarea class="page-text" dir="auto" spellcheck="false" placeholder="سيظهر النص هنا…"></textarea>
    </div>`;
  el.querySelector('strong').textContent = p.label;
  el.querySelector('.page-text').addEventListener('input', (e) => { p.text = e.target.value; });
  el.querySelector('.copy').addEventListener('click', () => copy(p.text));
  el.querySelector('.rotate').addEventListener('click', async () => {
    if (busy) { toast('انتظر حتى تنتهي القراءة الحالية'); return; }
    busy = true; cancelled = false;
    p.rotation = (p.rotation + 90) % 360;
    currentPageBase = 0; currentPageShare = 1;
    els.statusPanel.hidden = false;
    setStatus(`إعادة قراءة ${p.label}`, `بعد التدوير ${p.rotation}°`);
    setProgress(0);
    try { await processPage(p); } catch (e) { console.error(e); toast('تعذرت إعادة القراءة'); }
    finish();
  });
  p.el = el;
  return el;
}

function updateCard(p) {
  p.el.classList.remove('working');
  p.el.querySelector('.page-text').value = p.text;
  const c = p.el.querySelector('.conf');
  c.textContent = p.text ? `دقة القراءة ${p.conf}٪` : 'لا يوجد نص';
  c.className = 'conf ' + (!p.text ? 'bad' : p.conf >= 80 ? 'good' : p.conf >= 60 ? 'mid' : 'bad');
}

function allText() {
  return pages
    .filter((p) => p.text)
    .map((p) => (pages.length > 1 ? `—— ${p.label} ——\n` : '') + p.text)
    .join('\n\n');
}

function setStatus(main, sub) { els.statusText.textContent = main; els.statusSub.textContent = sub || ''; }
function setProgress(f) { els.bar.style.width = Math.max(0, Math.min(100, f * 100)) + '%'; }

let toastTimer;
function toast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { els.toast.hidden = true; }, 3200);
}

async function copy(text) {
  if (!text) { toast('لا يوجد نص للنسخ'); return; }
  try { await navigator.clipboard.writeText(text); }
  catch {
    const t = document.createElement('textarea');
    t.value = text; document.body.appendChild(t); t.select();
    document.execCommand('copy'); t.remove();
  }
  toast('تم النسخ');
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---------- الأحداث ----------

els.file.addEventListener('change', () => { handleFiles(els.file.files); els.file.value = ''; });
['dragenter', 'dragover'].forEach((t) => els.drop.addEventListener(t, (e) => { e.preventDefault(); els.drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((t) => els.drop.addEventListener(t, (e) => { e.preventDefault(); els.drop.classList.remove('over'); }));
els.drop.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files));

els.cancelBtn.addEventListener('click', async () => {
  cancelled = true;
  setStatus('جارٍ الإيقاف…', '');
  if (worker) { await worker.terminate(); worker = null; workerLang = ''; }
});

els.copyAll.addEventListener('click', () => copy(allText()));
els.dlTxt.addEventListener('click', () => {
  const t = allText();
  if (!t) { toast('لا يوجد نص للتنزيل'); return; }
  download(currentName + '.txt', new Blob(['﻿' + t], { type: 'text/plain;charset=utf-8' }));
});
els.dlDoc.addEventListener('click', () => {
  if (!allText()) { toast('لا يوجد نص للتنزيل'); return; }
  const body = pages.filter((p) => p.text).map((p) =>
    (pages.length > 1 ? `<h3>${escapeHtml(p.label)}</h3>` : '') +
    p.text.split('\n').map((l) => `<p dir="auto">${escapeHtml(l) || '&nbsp;'}</p>`).join('')
  ).join('<br style="page-break-before:always">');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${escapeHtml(currentName)}</title>
<style>body{font-family:'Traditional Arabic','Arial',sans-serif;font-size:14pt;direction:rtl}p{margin:0 0 4pt}h3{font-size:12pt;color:#555}</style></head><body dir="rtl">${body}</body></html>`;
  download(currentName + '.doc', new Blob(['﻿' + html], { type: 'application/msword' }));
});
els.newBtn.addEventListener('click', () => {
  if (busy) return;
  pages = [];
  els.pages.innerHTML = '';
  els.resultPanel.hidden = true;
  els.pickPanel.hidden = false;
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// للتجربة الآلية
window.ocrApp = { handleFiles, get pages() { return pages; }, get busy() { return busy; } };
