(function () {
  'use strict';
  var L = window.RejectionLogic;
  var SAMPLES = [
    "Status: Defective. Remark by Institute Nodal Officer: Income certificate uploaded is expired. Please upload a valid income certificate issued by the competent authority.",
    "Status: Defective. Remark: Name of applicant in Aadhaar does not match with name in marksheet. Details mismatch.",
    "Status: Rejected. Remark: Application not recommended."
  ];
  var TIMEOUT_MS = 20000;

  var notice = document.getElementById('notice');
  var lang = document.getElementById('lang');
  var go = document.getElementById('go');
  var count = document.getElementById('count');
  var result = document.getElementById('result');
  var live = result.parentNode;
  var cache = new Map();   // repeat questions cost nothing
  var inflight = null;

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function section(title) {
    var s = el('div', 'sec');
    s.appendChild(el('h3', null, title));
    return s;
  }

  function updateCount() {
    var n = notice.value.length;
    count.textContent = n + ' / ' + L.MAX_LEN;
    count.className = n >= L.MAX_LEN ? 'over' : '';
  }
  notice.addEventListener('input', updateCount);

  document.querySelectorAll('.chip').forEach(function (b) {
    b.addEventListener('click', function () { notice.value = SAMPLES[+b.dataset.s]; updateCount(); notice.focus(); });
  });

  function busy(on) {
    go.disabled = on;
    go.textContent = on ? 'Reading your notice...' : 'Explain my notice';
    live.setAttribute('aria-busy', on ? 'true' : 'false');
  }

  function showLoading() {
    result.textContent = '';
    var s = el('div', 'skeleton');
    s.setAttribute('aria-hidden', 'true');
    for (var i = 0; i < 4; i++) s.appendChild(el('span'));
    result.appendChild(s);
  }

  function fail(msg) {
    result.textContent = '';
    result.appendChild(el('p', 'err', msg));
    result.focus();
  }

  function show(raw, redactedCount) {
    var d = L.normalizeResponse(raw);
    var tone = 'tone-' + L.statusTone(d.status, d.matched);
    result.textContent = '';

    if (redactedCount > 0) {
      result.appendChild(el('div', 'flag', redactedCount + ' personal number' + (redactedCount > 1 ? 's were' : ' was') + ' hidden before sending.'));
    }

    if (d.note) result.appendChild(el('div', 'flag', d.note));

    var bar = el('div', 'stampbar');
    bar.appendChild(el('span', 'stamp ' + tone, d.status));
    if (d.matched && d.confidence) bar.appendChild(el('span', 'conf', 'Match confidence: ' + d.confidence));
    result.appendChild(bar);
    result.appendChild(el('h2', 'title', d.title));

    if (d.explanation) {
      var a = section('What it means');
      a.appendChild(el('p', null, d.explanation));
      result.appendChild(a);
    }
    if (d.fix_steps.length) {
      var b = section('What to do');
      var ol = el('ol', 'steps');
      d.fix_steps.forEach(function (s) { ol.appendChild(el('li', null, s)); });
      b.appendChild(ol);
      result.appendChild(b);
    }
    if (d.route) {
      var c = section('Where to go');
      c.appendChild(el('p', null, d.route + ' Contact: ' + d.contact + '.'));
      result.appendChild(c);
    }
    if (d.letter) {
      var l = section('Draft letter (edit before sending)');
      var pre = el('div', 'letter', d.letter);
      l.appendChild(pre);
      var btn = el('button', 'copy', 'Copy letter');
      btn.type = 'button';
      btn.addEventListener('click', function () {
        var done = function (t) { btn.textContent = t; setTimeout(function () { btn.textContent = 'Copy letter'; }, 1800); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(d.letter).then(function () { done('Copied'); }, function () { done('Copy failed. Select the text instead.'); });
        } else { done('Select the text and copy it.'); }
      });
      l.appendChild(btn);
      result.appendChild(l);
    }
    if (d.official_link) {
      var n = el('div', 'notice');
      n.appendChild(document.createTextNode('Check the official source before acting: '));
      var link = el('a', null, d.official_link);
      link.href = d.official_link; link.target = '_blank'; link.rel = 'noopener noreferrer';
      n.appendChild(link);
      result.appendChild(n);
    }
    result.focus();
  }

  go.addEventListener('click', function () {
    var v = L.validateNotice(notice.value);
    if (!v.ok) { fail(v.error); return; }

    var red = L.redactPII(v.text);
    var key = L.cacheKey(red.text, lang.value);
    if (cache.has(key)) { show(cache.get(key), red.count); return; }

    if (inflight) inflight.abort();
    var ctrl = new AbortController();
    inflight = ctrl;
    var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);
    busy(true); showLoading();

    fetch('/api/decode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notice: red.text, language: lang.value }),
      signal: ctrl.signal
    })
      .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, j: j }; }); })
      .then(function (x) {
        if (!x.ok) { fail((x.j && x.j.error) || 'Something went wrong. Try again in a moment.'); return; }
        cache.set(key, x.j);
        show(x.j, red.count);
      })
      .catch(function (e) {
        if (inflight !== ctrl) return; // superseded by a newer request
        fail(e && e.name === 'AbortError'
          ? 'The server took too long to answer. Try again.'
          : 'Could not reach the server. Check your connection and try again.');
      })
      .finally(function () { clearTimeout(timer); if (inflight === ctrl) { inflight = null; busy(false); } });
  });

  notice.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') go.click();
  });
  updateCount();
})();
