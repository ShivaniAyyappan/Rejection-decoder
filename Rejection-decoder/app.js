(function () {
  'use strict';

  var L = window.RejectionLogic;
  if (!L) return;

  var SAMPLES = {
    income:
      'Status: Defective. Remark by Institute Nodal Officer: Income certificate uploaded is expired. Please upload a valid income certificate issued by the competent authority.',
    name:
      'Status: Defective. Remark: Name of applicant in Aadhaar does not match with name in marksheet. Details mismatch.',
    unclear: 'Status: Rejected. Remark: Application not recommended.',
    bank:
      'Status: Payment failed. Remark: Beneficiary bank account is not seeded with NPCI / DBT mapper or account details mismatch.'
  };

  var TIMEOUT_MS = 20000;
  var MAX_CACHE_SIZE = 100;

  var noticeEl = document.getElementById('noticeInput');
  var langEl = document.getElementById('langSelect');
  var goBtn = document.getElementById('explainBtn');
  var clearBtn = document.getElementById('clearBtn');
  var copyBtn = document.getElementById('copyBtn');
  var countEl = document.getElementById('charCount');
  var resultEl = document.getElementById('outputContainer');
  var headingEl = document.getElementById('outputHeading');
  var maskedBannerEl = document.getElementById('maskedBanner');

  if (!noticeEl || !langEl || !goBtn || !resultEl) return;

  var cache = new Map();
  var inflight = null;

  function setCache(key, value) {
    if (cache.has(key)) cache.delete(key);
    cache.set(key, value);
    if (cache.size > MAX_CACHE_SIZE) {
      var oldestKey = cache.keys().next().value;
      cache.delete(oldestKey);
    }
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function createBlock(title, accentPink) {
    var box = el('div', accentPink ? 'preview-item accent-pink' : 'preview-item');
    var heading = el('h3');
    heading.appendChild(el('span', accentPink ? 'dot pink' : 'dot'));
    heading.appendChild(document.createTextNode(' ' + title));
    box.appendChild(heading);
    return box;
  }

  function updateCount() {
    var len = noticeEl.value.length;
    if (countEl) {
      countEl.textContent = len + ' / ' + L.MAX_LEN;
      countEl.classList.toggle('over', len >= L.MAX_LEN);
    }
  }

  function setBusy(isBusy) {
    goBtn.disabled = isBusy;
    goBtn.textContent = isBusy ? 'Reading your notice...' : 'Explain my notice ->';
    resultEl.setAttribute('aria-busy', isBusy ? 'true' : 'false');
  }

  function setMaskedBanner(count) {
    if (!maskedBannerEl) return;
    if (count > 0) {
      maskedBannerEl.textContent =
        'Local privacy filter hid ' +
        count +
        ' sensitive number' +
        (count > 1 ? 's' : '') +
        ' on your device before sending.';
      maskedBannerEl.classList.add('visible');
    } else {
      maskedBannerEl.textContent = '';
      maskedBannerEl.classList.remove('visible');
    }
  }

  function showError(message) {
    if (headingEl) headingEl.textContent = 'Check Your Input';
    resultEl.textContent = '';
    var errBox = createBlock('Notice error', true);
    errBox.appendChild(el('p', 'err-text', message));
    resultEl.appendChild(errBox);
  }

  function renderResult(rawPayload, redactedCount) {
    var d = L.normalizeResponse(rawPayload);
    var toneClass = 'tone-' + L.statusTone(d.status, d.matched);

    setMaskedBanner(redactedCount);
    if (headingEl) {
      headingEl.textContent = d.title + (langEl.value && langEl.value !== 'English' ? ' (' + langEl.value + ')' : '');
    }

    resultEl.textContent = '';

    var statusRow = el('div', 'status-strip');
    statusRow.appendChild(el('span', 'stamp ' + toneClass, d.status));
    if (d.matched && d.confidence) {
      statusRow.appendChild(el('span', 'conf-pill', 'Confidence: ' + d.confidence));
    }
    if (d.note) {
      statusRow.appendChild(el('span', 'note-pill', d.note));
    }
    resultEl.appendChild(statusRow);

    if (d.explanation) {
      var meaningBlock = createBlock('Plain-Language Meaning', true);
      meaningBlock.appendChild(el('p', null, d.explanation));
      resultEl.appendChild(meaningBlock);
    }

    if (d.fix_steps.length > 0) {
      var stepsBlock = createBlock('Practical Fix Checklist', false);
      var list = el('ol', 'steps-list');
      for (var i = 0; i < d.fix_steps.length; i++) {
        list.appendChild(el('li', null, d.fix_steps[i]));
      }
      stepsBlock.appendChild(list);
      resultEl.appendChild(stepsBlock);
    }

    if (d.route || d.contact) {
      var contactBlock = createBlock('Who to Contact', true);
      var contactText = d.route ? d.route + ' Contact: ' + d.contact + '.' : 'Contact: ' + d.contact + '.';
      contactBlock.appendChild(el('p', null, contactText));
      resultEl.appendChild(contactBlock);
    }

    if (d.letter) {
      var letterBlock = createBlock('Draft Letter (Edit Before Sending)', false);
      letterBlock.appendChild(el('pre', 'draft-letter', d.letter));
      resultEl.appendChild(letterBlock);
    }

    if (d.official_link) {
      var linkBlock = createBlock('Official Portal Reference', false);
      var anchor = el('a', 'official-link', d.official_link);
      anchor.href = d.official_link;
      anchor.target = '_blank';
      anchor.rel = 'noopener noreferrer';
      linkBlock.appendChild(anchor);
      resultEl.appendChild(linkBlock);
    }
  }

  function handleDecode() {
    var validation = L.validateNotice(noticeEl.value);
    if (!validation.ok) {
      showError(validation.error);
      return;
    }

    var redacted = L.redactPII(validation.text);
    var key = L.cacheKey(redacted.text, langEl.value);

    if (cache.has(key)) {
      renderResult(cache.get(key), redacted.count);
      return;
    }

    if (inflight) {
      inflight.controller.abort();
      clearTimeout(inflight.timer);
    }

    var controller = new AbortController();
    var timer = setTimeout(function () {
      controller.abort();
    }, TIMEOUT_MS);
    inflight = { controller: controller, timer: timer };

    setBusy(true);
    setMaskedBanner(redacted.count);
    if (headingEl) headingEl.textContent = 'Analyzing Notice...';
    resultEl.textContent = '';
    var loadingBox = createBlock('Reading your notice', true);
    loadingBox.appendChild(el('p', null, 'Checking status patterns and preparing guidance...'));
    resultEl.appendChild(loadingBox);

    fetch('/api/decode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ notice: redacted.text, language: langEl.value }),
      signal: controller.signal
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (payload) {
        if (!payload.ok) {
          showError((payload.data && payload.data.error) || 'Could not decode this notice right now.');
          return;
        }
        setCache(key, payload.data);
        renderResult(payload.data, redacted.count);
      })
      .catch(function (err) {
        if (!inflight || inflight.controller !== controller) return;
        showError(
          err && err.name === 'AbortError'
            ? 'The request timed out. Please try again.'
            : 'Unable to reach the server. Check your connection and try again.'
        );
      })
      .finally(function () {
        clearTimeout(timer);
        if (inflight && inflight.controller === controller) {
          inflight = null;
          setBusy(false);
        }
      });
  }

  noticeEl.addEventListener('input', updateCount);
  noticeEl.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleDecode();
    }
  });

  goBtn.addEventListener('click', handleDecode);

  if (clearBtn) {
    clearBtn.addEventListener('click', function () {
      if (inflight) {
        inflight.controller.abort();
        clearTimeout(inflight.timer);
        inflight = null;
        setBusy(false);
      }
      noticeEl.value = '';
      updateCount();
      setMaskedBanner(0);
      document.querySelectorAll('.chip').forEach(function (chip) {
        chip.classList.remove('active');
      });
      if (headingEl) headingEl.textContent = 'What You Will Get';
      resultEl.textContent = '';
      var m1 = createBlock('Plain-Language Meaning', true);
      m1.appendChild(el('p', null, 'Translates portal status labels and verification remarks into clear, everyday terms.'));
      var m2 = createBlock('Practical Fix Checklist', false);
      var ul = el('ul');
      ul.appendChild(el('li', null, 'Check which document, field, or bank detail was flagged.'));
      ul.appendChild(el('li', null, 'Prepare a clear, valid replacement or correction before the portal window closes.'));
      m2.appendChild(ul);
      var m3 = createBlock('Who to Contact', true);
      m3.appendChild(el('p', null, 'Shows whether to start with your institute nodal officer, verifier, or portal helpdesk.'));
      resultEl.appendChild(m1);
      resultEl.appendChild(m2);
      resultEl.appendChild(m3);
    });
  }

  document.querySelectorAll('.chip[data-sample]').forEach(function (chip) {
    chip.addEventListener('click', function () {
      var sampleKey = chip.getAttribute('data-sample');
      var text = SAMPLES[sampleKey];
      if (!text) return;
      document.querySelectorAll('.chip').forEach(function (c) {
        c.classList.toggle('active', c.getAttribute('data-sample') === sampleKey);
      });
      noticeEl.value = text;
      updateCount();
      noticeEl.focus();
    });
  });

  if (copyBtn) {
    copyBtn.addEventListener('click', function () {
      var summary = (resultEl.innerText || '').trim();
      if (!summary) return;
      var finish = function (label) {
        var prev = copyBtn.textContent;
        copyBtn.textContent = label;
        setTimeout(function () {
          copyBtn.textContent = prev;
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(summary).then(
          function () { finish('Copied'); },
          function () { finish('Select text to copy'); }
        );
      } else {
        finish('Select text to copy');
      }
    });
  }

  updateCount();
})();
