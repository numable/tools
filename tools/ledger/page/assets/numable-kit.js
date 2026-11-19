/* numable-kit 1.1.0 —— Numable 工具页面样式套件 · 选择弹层
 *
 * 由 `numable kit apply` 写入,别直接改本文件。最新版:https://docs.numable.app/kit/v1/numable-kit.js
 *
 * 用法:页面里照常写原生控件,加 class="nb-input" 即可:
 *   <select class="nb-input">…</select>
 *   <input class="nb-input" type="date" min="…" max="…">
 *   <input class="nb-input" type="time" step="300">
 * 原控件仍是值的唯一来源(读 .value、听 change);套件只换掉「点开后弹出什么」。
 * 不想接管的控件加 data-nb-native。脚本改了 .value 之后调 nbKit.sync(el) 刷新显示。
 * 也可以直接调:nbKit.pick({ kind: 'select'|'date'|'time', title, value, options, min, max, step }) → Promise<值 | null>
 */
(function () {
  'use strict';
  var TEXT = {
    zh: { close: '关闭', ok: '确定', today: '今天', clear: '清除', search: '搜索', none: '没有匹配的选项', pick: '请选择', date: '选择日期', time: '选择时间', prev: '上个月', next: '下个月', hour: '时', minute: '分' },
    en: { close: 'Close', ok: 'Done', today: 'Today', clear: 'Clear', search: 'Search', none: 'No matches', pick: 'Select', date: 'Select date', time: 'Select time', prev: 'Previous month', next: 'Next month', hour: 'Hour', minute: 'Minute' }
  };
  var ICON = {
    x: '<svg viewBox="0 0 256 256"><path d="M205.7 194.3a8 8 0 0 1-11.4 11.4L128 139.3l-66.3 66.4a8 8 0 0 1-11.4-11.4l66.4-66.3-66.4-66.3a8 8 0 0 1 11.4-11.4l66.3 66.4 66.3-66.4a8 8 0 0 1 11.4 11.4L139.3 128Z"/></svg>',
    l: '<svg viewBox="0 0 256 256"><path d="M165.7 202.3a8 8 0 0 1-11.4 11.4l-80-80a8 8 0 0 1 0-11.4l80-80a8 8 0 0 1 11.4 11.4L91.3 128Z"/></svg>',
    r: '<svg viewBox="0 0 256 256"><path d="m181.7 133.7-80 80a8 8 0 0 1-11.4-11.4l74.4-74.3-74.4-74.3a8 8 0 0 1 11.4-11.4l80 80a8 8 0 0 1 0 11.4Z"/></svg>',
    date: '<svg viewBox="0 0 256 256"><path d="M208 32h-24v-8a8 8 0 0 0-16 0v8H88v-8a8 8 0 0 0-16 0v8H48a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h160a16 16 0 0 0 16-16V48a16 16 0 0 0-16-16ZM72 48v8a8 8 0 0 0 16 0v-8h80v8a8 8 0 0 0 16 0v-8h24v32H48V48Zm136 160H48V96h160v112Z"/></svg>',
    time: '<svg viewBox="0 0 256 256"><path d="M128 24a104 104 0 1 0 104 104A104.1 104.1 0 0 0 128 24Zm0 192a88 88 0 1 1 88-88 88.1 88.1 0 0 1-88 88Zm64-88a8 8 0 0 1-8 8h-56a8 8 0 0 1-8-8V72a8 8 0 0 1 16 0v48h48a8 8 0 0 1 8 8Z"/></svg>'
  };
  var ROOT = document.documentElement;
  function lang() { return /^en/i.test(ROOT.getAttribute('data-lang') || ROOT.lang || 'zh') ? 'en' : 'zh'; }
  function t(k) { return TEXT[lang()][k]; }
  /* 一周从哪天开始:宿主给 data-first-weekday(0 = 周日)时用它,否则中文周一、英文周日 */
  function firstWeekday() { var v = ROOT.getAttribute('data-first-weekday'); return v != null && v !== '' ? (+v % 7) : (lang() === 'en' ? 0 : 1); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parseISO(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; }
  function locale() { return lang() === 'en' ? 'en-US' : 'zh-CN'; }
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- 弹层壳:遮罩独立淡入、卡片贴底滑上、左上 ✕、标题居中 ---------- */
  var openCount = 0;
  function sheet(title, okText) {
    var back = document.activeElement;
    var pop = h('div', 'nb-pop');
    var scrim = h('div', 'nb-pop-scrim');
    var card = h('div', 'nb-pop-card');
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-label', title);
    var head = h('div', 'nb-pop-head', '<h3>' + esc(title) + '</h3>');
    var x = h('button', 'nb-pop-x', ICON.x); x.type = 'button'; x.setAttribute('aria-label', t('close'));
    head.insertBefore(x, head.firstChild);
    var ok = null;
    if (okText) { ok = h('button', 'nb-btn nb-btn--sm nb-pop-ok', esc(okText)); ok.type = 'button'; head.appendChild(ok); }
    var body = h('div', 'nb-pop-body');
    card.appendChild(head); card.appendChild(body); pop.appendChild(scrim); pop.appendChild(card);
    document.body.appendChild(pop);
    if (openCount++ === 0) ROOT.style.overflow = 'hidden';
    requestAnimationFrame(function () { requestAnimationFrame(function () { pop.classList.add('is-in'); }); });
    var done = false, resolve;
    var p = new Promise(function (r) { resolve = r; });
    function close(v) {
      if (done) return; done = true;
      pop.classList.remove('is-in');
      document.removeEventListener('keydown', onKey, true);
      setTimeout(function () {
        pop.remove();
        if (--openCount === 0) ROOT.style.overflow = '';
        if (back && back.focus) back.focus({ preventScroll: true });
      }, 300);
      resolve(v);
    }
    function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); close(null); } }
    document.addEventListener('keydown', onKey, true);
    scrim.onclick = function () { close(null); };
    x.onclick = function () { close(null); };
    setTimeout(function () { (ok || x).focus({ preventScroll: true }); }, 30);
    return { body: body, ok: ok, close: close, promise: p };
  }

  /* ---------- 下拉:点一项即选中并关闭;超过 8 项带搜索 ---------- */
  function pickSelect(o) {
    var s = sheet(o.title || t('pick'));
    var list = h('div', ''); list.setAttribute('role', 'listbox');
    var opts = o.options || [];
    if (opts.length > 8) {
      var wrap = h('div', 'nb-pop-search');
      var q = h('input', 'nb-input'); q.type = 'search'; q.placeholder = t('search');
      q.style.background = 'var(--nb-tile)';
      wrap.appendChild(q); s.body.appendChild(wrap);
      q.oninput = function () { render(q.value.trim().toLowerCase()); };
    }
    s.body.appendChild(list);
    function render(f) {
      list.innerHTML = '';
      var n = 0;
      opts.forEach(function (op) {
        if (f && (op.label + ' ' + (op.sub || '')).toLowerCase().indexOf(f) < 0) return;
        n++;
        var b = h('button', 'nb-opt', '<span>' + esc(op.label) + (op.sub ? '<small>' + esc(op.sub) + '</small>' : '') + '</span>');
        b.type = 'button'; b.setAttribute('role', 'option');
        b.setAttribute('aria-selected', String(op.value === o.value));
        b.disabled = !!op.disabled;
        b.onclick = function () { s.close(op.value); };
        list.appendChild(b);
      });
      if (!n) list.appendChild(h('div', 'nb-pop-empty', esc(t('none'))));
    }
    render('');
    var cur = list.querySelector('[aria-selected="true"]');
    /* 只滚弹层自己,不用 scrollIntoView(它会连带滚动底下的页面) */
    if (cur) setTimeout(function () { s.body.scrollTop = cur.offsetTop - s.body.clientHeight / 2 + cur.offsetHeight / 2; cur.focus({ preventScroll: true }); }, 40);
    return s.promise;
  }

  /* ---------- 日期:月历,点一天即选中并关闭 ---------- */
  function pickDate(o) {
    var s = sheet(o.title || t('date'));
    var sel = parseISO(o.value), min = parseISO(o.min), max = parseISO(o.max), today = parseISO(iso(new Date()));
    var view = new Date((sel || today).getFullYear(), (sel || today).getMonth(), 1);
    var cal = h('div', 'nb-cal'); s.body.appendChild(cal);
    var fmtMonth = new Intl.DateTimeFormat(locale(), { year: 'numeric', month: 'long' });
    var fmtWd = new Intl.DateTimeFormat(locale(), { weekday: 'narrow' });
    var fw = firstWeekday();
    function out(d) { return (min && d < min) || (max && d > max); }
    function render() {
      cal.innerHTML = '';
      var nav = h('div', 'nb-cal-nav', '<strong>' + esc(fmtMonth.format(view)) + '</strong>');
      var btns = h('div', '');
      var pv = h('button', '', ICON.l), nx = h('button', '', ICON.r);
      pv.type = nx.type = 'button'; pv.setAttribute('aria-label', t('prev')); nx.setAttribute('aria-label', t('next'));
      pv.disabled = !!(min && new Date(view.getFullYear(), view.getMonth(), 0) < min);
      nx.disabled = !!(max && new Date(view.getFullYear(), view.getMonth() + 1, 1) > max);
      pv.onclick = function () { view.setMonth(view.getMonth() - 1); render(); };
      nx.onclick = function () { view.setMonth(view.getMonth() + 1); render(); };
      btns.appendChild(pv); btns.appendChild(nx); nav.appendChild(btns); cal.appendChild(nav);
      var g = h('div', 'nb-cal-grid'); g.setAttribute('role', 'grid');
      for (var i = 0; i < 7; i++) g.appendChild(h('div', 'nb-cal-wd', esc(fmtWd.format(new Date(2023, 0, 1 + (fw + i) % 7)))));
      var lead = (view.getDay() - fw + 7) % 7, days = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      for (var k = 0; k < lead; k++) g.appendChild(h('span', 'nb-cal-d is-out'));
      for (var d = 1; d <= days; d++) (function (d) {
        var dt = new Date(view.getFullYear(), view.getMonth(), d);
        var b = h('button', 'nb-cal-d', String(d)); b.type = 'button';
        if (+dt === +today) b.classList.add('is-today');
        if (sel && +dt === +sel) b.setAttribute('aria-selected', 'true');
        b.disabled = !!out(dt);
        b.setAttribute('aria-label', new Intl.DateTimeFormat(locale(), { dateStyle: 'full' }).format(dt));
        b.onclick = function () { s.close(iso(dt)); };
        g.appendChild(b);
      })(d);
      cal.appendChild(g);
      var foot = h('div', 'nb-cal-foot');
      var tb = h('button', 'nb-btn nb-btn--plain nb-btn--sm', esc(t('today'))); tb.type = 'button';
      tb.disabled = !!out(today);
      tb.onclick = function () { s.close(iso(today)); };
      foot.appendChild(tb);
      if (!o.required) { var cb = h('button', 'nb-btn nb-btn--plain nb-btn--sm', esc(t('clear'))); cb.type = 'button'; cb.style.color = 'var(--nb-sub)'; cb.onclick = function () { s.close(''); }; foot.appendChild(cb); }
      cal.appendChild(foot);
    }
    render();
    return s.promise;
  }

  /* ---------- 时间:两列滚轮(24 小时),「确定」提交 ---------- */
  function pickTime(o) {
    var s = sheet(o.title || t('time'), t('ok'));
    var stepMin = Math.max(1, Math.round((+o.step || 60) / 60));
    var m = /^(\d{1,2}):(\d{2})/.exec(o.value || '');
    var now = new Date();
    var hh = m ? +m[1] : now.getHours(), mm = m ? +m[2] : now.getMinutes();
    mm = Math.round(mm / stepMin) * stepMin % 60;
    var wheel = h('div', 'nb-wheel'); s.body.appendChild(wheel);
    function col(n, step, cur, label) {
      var c = h('div', 'nb-wheel-col'); c.setAttribute('aria-label', label); c.tabIndex = 0;
      var vals = [];
      for (var v = 0; v < n; v += step) { vals.push(v); c.appendChild(h('div', '', pad(v))); }
      c.querySelectorAll('div').forEach(function (it, i) { it.onclick = function () { c.scrollTo({ top: i * 40, behavior: 'smooth' }); }; });
      c.onkeydown = function (e) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); c.scrollBy({ top: e.key === 'ArrowDown' ? 40 : -40, behavior: 'smooth' }); }
      };
      wheel.appendChild(c);
      setTimeout(function () { c.scrollTop = Math.max(0, vals.indexOf(cur)) * 40; }, 0);
      return function () { return vals[Math.min(vals.length - 1, Math.max(0, Math.round(c.scrollTop / 40)))]; };
    }
    var gh = col(24, 1, hh, t('hour'));
    wheel.appendChild(h('div', 'nb-wheel-sep', ':'));
    var gm = col(60, stepMin, mm, t('minute'));
    s.ok.onclick = function () { s.close(pad(gh()) + ':' + pad(gm())); };
    return s.promise;
  }

  function pick(o) {
    o = o || {};
    if (o.kind === 'date') return pickDate(o);
    if (o.kind === 'time') return pickTime(o);
    return pickSelect(o);
  }

  /* ---------- 接管原生控件 ---------- */
  function kindOf(el) { return el.tagName === 'SELECT' ? 'select' : el.type === 'date' ? 'date' : el.type === 'time' ? 'time' : null; }
  function titleOf(el) {
    var l = el.id && document.querySelector('label[for="' + el.id + '"]');
    var s = (l && l.textContent) || el.getAttribute('aria-label') || el.getAttribute('title') || '';
    return s.replace(/\s*\d+\s*\/\s*\d+\s*$/, '').replace(/[（(][^）)]*[）)]\s*$/, '').trim();
  }
  function display(el) {
    var k = kindOf(el), v = el.value;
    if (k === 'select') { var op = el.options[el.selectedIndex]; return op && op.value !== '' ? op.textContent : ''; }
    if (k === 'date') {
      var d = parseISO(v); if (!d) return '';
      /* 今年内省略年份,半宽格子里也放得下;跨年才带年 */
      var f = { month: 'short', day: 'numeric', weekday: 'short' };
      if (d.getFullYear() !== new Date().getFullYear()) f.year = 'numeric';
      return new Intl.DateTimeFormat(locale(), f).format(d);
    }
    return v ? v.slice(0, 5) : '';
  }
  function placeholderOf(el) {
    var k = kindOf(el);
    if (k === 'select') { var p = el.querySelector('option[value=""]'); return (p && p.textContent) || t('pick'); }
    return el.getAttribute('placeholder') || t(k === 'date' ? 'date' : 'time');
  }
  function sync(el) {
    var b = el._nbTrigger; if (!b) return;
    var text = display(el);
    b.firstChild.textContent = text || placeholderOf(el);
    b.classList.toggle('is-empty', !text);
    b.disabled = el.disabled;
  }
  function enhance(root) {
    (root || document).querySelectorAll('select.nb-input, input.nb-input[type="date"], input.nb-input[type="time"]').forEach(function (el) {
      if (el._nbTrigger || el.hasAttribute('data-nb-native')) return;
      var k = kindOf(el);
      var b = h('button', 'nb-input nb-trigger', '<span></span>' + (k === 'date' ? ICON.date : k === 'time' ? ICON.time : ''));
      // 原控件上 nb- 开头的修饰类(如 nb-input--sm)带到触发块上;页面自己的类不带,免得页面样式压过套件
      Array.prototype.forEach.call(el.classList, function (c) { if (c.indexOf('nb-') === 0 && c !== 'nb-input') b.classList.add(c); });
      b.type = 'button'; b.setAttribute('data-kind', k); b.setAttribute('aria-haspopup', 'dialog');
      el._nbTitle = titleOf(el);
      if (el.id) {
        b.id = el.id + '-nb';
        var lab = document.querySelector('label[for="' + el.id + '"]'); if (lab) lab.htmlFor = b.id;
      }
      if (el.getAttribute('aria-label')) b.setAttribute('aria-label', el.getAttribute('aria-label'));
      el._nbTrigger = b;
      el.hidden = true; el.tabIndex = -1;
      el.parentNode.insertBefore(b, el.nextSibling);
      el.addEventListener('change', function () { sync(el); });
      // 页面脚本直接改 .value / .selectedIndex / .disabled、或重填选项时不会派发 change:
      // 在这个元素上包一层 setter + 监听选项变化,显示跟着走(老页面不用自己调 nbKit.sync)
      ['value', 'selectedIndex', 'disabled'].forEach(function (prop) {
        var proto = Object.getPrototypeOf(el), d;
        while (proto && !(d = Object.getOwnPropertyDescriptor(proto, prop))) proto = Object.getPrototypeOf(proto);
        if (!d || !d.set) return;
        try {
          Object.defineProperty(el, prop, {
            configurable: true, enumerable: d.enumerable,
            get: function () { return d.get.call(this); },
            set: function (v) { d.set.call(this, v); sync(this); }
          });
        } catch (e) { /* 不可改的环境:退回只认 change */ }
      });
      if (k === 'select') new MutationObserver(function () { sync(el); }).observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['selected', 'disabled', 'label'], characterData: true });
      b.onclick = function () {
        var opts = k === 'select' ? Array.prototype.map.call(el.options, function (op) {
          return { value: op.value, label: op.textContent, sub: op.getAttribute('data-sub') || '', disabled: op.disabled || op.hidden };
        }).filter(function (op) { return op.value !== ''; }) : null;
        b.classList.add('is-open');
        pick({ kind: k, title: el._nbTitle, value: el.value, options: opts, min: el.min, max: el.max, step: el.step, required: el.required })
          .then(function (v) {
            b.classList.remove('is-open');
            if (v == null || v === el.value) return;
            el.value = v;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          });
      };
      sync(el);
    });
  }

  window.nbKit = { pick: pick, enhance: enhance, sync: sync };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { enhance(); });
  else enhance();
  new MutationObserver(function (ms) {
    ms.forEach(function (m) { m.addedNodes.forEach(function (n) { if (n.nodeType === 1 && !n.closest('.nb-pop')) enhance(n.parentNode || n); }); });
  }).observe(ROOT, { childList: true, subtree: true });
})();
