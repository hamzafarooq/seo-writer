/* -------------------------------------------------------
   Chapter Humanizer — Word Add-in task pane logic
------------------------------------------------------- */

// Paragraph styles that should never be humanized (code, captions, etc.)
const SKIP_STYLES = new Set([
  '.Code', 'Code', 'Code Block',
  '.Code Annotation', 'Code Annotation',
  '.Figure Caption', 'Figure Caption',
  '.Table Caption', 'Table Caption',
  '.Table Body', 'Table Grid',
  'CO Chapter Number', 'CO Chapter Title',
  'Header', 'Footer',
]);

const MIN_PARA_LENGTH = 30; // skip very short paragraphs

let paragraphData = []; // { index, originalText, humanizedText, status }

/* -------------------------------------------------------
   Office init
------------------------------------------------------- */
Office.onReady((info) => {
  if (info.host !== Office.HostType.Word) return;

  document.getElementById('save-key-btn').addEventListener('click', saveApiKey);
  document.getElementById('scan-btn').addEventListener('click', scanDocument);
  document.getElementById('accept-all-btn').addEventListener('click', acceptAll);
  document.getElementById('humanize-selection-btn').addEventListener('click', humanizeSelection);

  // Restore saved key
  const saved = localStorage.getItem('ch-api-key');
  if (saved) {
    document.getElementById('api-key').value = saved;
    document.getElementById('key-status').textContent = 'API key loaded.';
  }
});

/* -------------------------------------------------------
   API Key
------------------------------------------------------- */
function saveApiKey() {
  const key = document.getElementById('api-key').value.trim();
  if (!key.startsWith('sk-ant')) {
    setKeyStatus('Key should start with sk-ant...', true);
    return;
  }
  localStorage.setItem('ch-api-key', key);
  setKeyStatus('Saved ✓');
}

function setKeyStatus(msg, isError = false) {
  const el = document.getElementById('key-status');
  el.textContent = msg;
  el.style.color = isError ? '#dc2626' : '#15803d';
}

function getApiKey() {
  return localStorage.getItem('ch-api-key') || '';
}

/* -------------------------------------------------------
   Scan entire document
------------------------------------------------------- */
async function scanDocument() {
  if (!getApiKey()) { showToast('Enter your API key first', true); return; }

  paragraphData = [];
  document.getElementById('paragraph-list').innerHTML = '';
  document.getElementById('summary-bar').classList.add('hidden');
  showProgress(0, 'Reading document...');

  try {
    await Word.run(async (context) => {
      const paras = context.document.body.paragraphs;
      paras.load('text, style');
      await context.sync();

      paras.items.forEach((p, i) => {
        const text = p.text.trim();
        if (!text || text.length < MIN_PARA_LENGTH) return;
        if (SKIP_STYLES.has(p.style)) return;

        paragraphData.push({ index: i, originalText: text, humanizedText: null, status: 'pending' });
      });
    });

    if (paragraphData.length === 0) {
      hideProgress();
      showToast('No humanizable paragraphs found', true);
      return;
    }

    renderAllCards();
    updateSummary();
    hideProgress();

    showToast(`Found ${paragraphData.length} paragraphs. Click Humanize on each one.`);

  } catch (err) {
    hideProgress();
    showToast('Error reading document: ' + err.message, true);
  }
}

/* -------------------------------------------------------
   Humanize a single paragraph (on-demand)
------------------------------------------------------- */
async function humanizeParagraphAt(i) {
  const p = paragraphData[i];
  if (p.status === 'processing') return;

  setCardStatus(i, 'processing');
  updateBtnState(i, false);

  try {
    const response = await fetch('/api/humanize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: p.originalText, apiKey: getApiKey() }),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'API error');

    const humanized = data.result;
    paragraphData[i].humanizedText = humanized;
    paragraphData[i].status = 'ready';

    // Update card to show the suggestion
    const card = document.getElementById(`card-${i}`);
    const suggestionEl = card.querySelector('.suggestion');
    suggestionEl.textContent = humanized;
    suggestionEl.classList.remove('hidden');

    card.querySelector('.suggestion-label').classList.remove('hidden');
    card.querySelector('.actions').classList.remove('hidden');
    card.querySelector('.humanize-btn').classList.add('hidden');

    setCardStatus(i, 'ready');
    updateSummary();

  } catch (err) {
    setCardStatus(i, 'error');
    updateBtnState(i, true);
    showToast('Error: ' + err.message, true);
  }
}

/* -------------------------------------------------------
   Humanize selected text only
------------------------------------------------------- */
async function humanizeSelection() {
  if (!getApiKey()) { showToast('Enter your API key first', true); return; }

  let selectedText = '';

  try {
    await Word.run(async (context) => {
      const sel = context.document.getSelection();
      sel.load('text');
      await context.sync();
      selectedText = sel.text.trim();
    });
  } catch (err) {
    showToast('Could not read selection', true);
    return;
  }

  if (!selectedText || selectedText.length < 10) {
    showToast('Select some text in your document first', true);
    return;
  }

  // Show a floating card at the top of the panel
  showSelectionCard(selectedText);
}

function showSelectionCard(text) {
  const list = document.getElementById('paragraph-list');

  // Remove existing selection card if any
  const existing = document.getElementById('selection-card');
  if (existing) existing.remove();

  const card = document.createElement('div');
  card.className = 'paragraph-card card-selection';
  card.id = 'selection-card';
  card.innerHTML = `
    <div class="card-header">
      <span class="para-label">✏️ Selected Text</span>
      <span class="status-badge status-pending">pending</span>
    </div>
    <div class="original-text">${escapeHtml(text)}</div>
    <p class="suggestion-label hidden">Suggested rewrite:</p>
    <div class="suggestion hidden"></div>
    <div class="actions hidden">
      <button class="btn-accept" onclick="acceptSelectionCard()">Accept</button>
      <button class="btn-skip" onclick="document.getElementById('selection-card').remove()">Dismiss</button>
    </div>
    <button class="humanize-btn btn-humanize" id="sel-humanize-btn">Humanize</button>
  `;

  list.prepend(card);

  card.querySelector('#sel-humanize-btn').addEventListener('click', async () => {
    card.querySelector('#sel-humanize-btn').disabled = true;
    card.querySelector('#sel-humanize-btn').textContent = 'Working...';

    const badge = card.querySelector('.status-badge');
    badge.className = 'status-badge status-processing';
    badge.textContent = 'processing';

    try {
      const response = await fetch('/api/humanize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, apiKey: getApiKey() }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'API error');

      card._humanized = data.result;
      card._original = text;

      card.querySelector('.suggestion').textContent = data.result;
      card.querySelector('.suggestion').classList.remove('hidden');
      card.querySelector('.suggestion-label').classList.remove('hidden');
      card.querySelector('.actions').classList.remove('hidden');
      card.querySelector('#sel-humanize-btn').classList.add('hidden');

      badge.className = 'status-badge status-ready';
      badge.textContent = 'ready';

    } catch (err) {
      badge.className = 'status-badge status-error';
      badge.textContent = 'error';
      card.querySelector('#sel-humanize-btn').textContent = 'Retry';
      card.querySelector('#sel-humanize-btn').disabled = false;
      showToast(err.message, true);
    }
  });
}

async function acceptSelectionCard() {
  const card = document.getElementById('selection-card');
  if (!card || !card._humanized) return;

  try {
    await Word.run(async (context) => {
      const results = context.document.body.search(card._original, { matchCase: true });
      results.load('text');
      await context.sync();
      if (results.items.length > 0) {
        results.items[0].insertText(card._humanized, Word.InsertLocation.replace);
        await context.sync();
      }
    });
    card.remove();
    showToast('Replaced selection ✓');
  } catch (err) {
    showToast('Error replacing: ' + err.message, true);
  }
}

/* -------------------------------------------------------
   Accept / Skip individual cards
------------------------------------------------------- */
async function acceptParagraph(i) {
  const p = paragraphData[i];
  if (!p.humanizedText) return;

  try {
    await Word.run(async (context) => {
      // Search for the original text and replace the first match
      const results = context.document.body.search(p.originalText, { matchCase: true });
      results.load('text');
      await context.sync();

      if (results.items.length > 0) {
        results.items[0].insertText(p.humanizedText, Word.InsertLocation.replace);
        await context.sync();
      } else {
        throw new Error('Could not find original text in document');
      }
    });

    paragraphData[i].status = 'accepted';
    setCardStatus(i, 'accepted');
    document.getElementById(`card-${i}`).querySelector('.actions').classList.add('hidden');
    updateSummary();

  } catch (err) {
    showToast('Error: ' + err.message, true);
  }
}

function skipParagraph(i) {
  paragraphData[i].status = 'skipped';
  setCardStatus(i, 'skipped');
  document.getElementById(`card-${i}`).querySelector('.actions').classList.add('hidden');
  document.getElementById(`card-${i}`).querySelector('.humanize-btn')?.classList.add('hidden');
  updateSummary();
}

/* -------------------------------------------------------
   Accept All ready paragraphs
------------------------------------------------------- */
async function acceptAll() {
  const ready = paragraphData.filter(p => p.status === 'ready' && p.humanizedText);
  if (ready.length === 0) {
    showToast('Humanize some paragraphs first', true);
    return;
  }

  try {
    await Word.run(async (context) => {
      for (const p of ready) {
        const results = context.document.body.search(p.originalText, { matchCase: true });
        results.load('text');
        await context.sync();
        if (results.items.length > 0) {
          results.items[0].insertText(p.humanizedText, Word.InsertLocation.replace);
        }
      }
      await context.sync();
    });

    ready.forEach(p => {
      const idx = paragraphData.indexOf(p);
      paragraphData[idx].status = 'accepted';
      setCardStatus(idx, 'accepted');
      document.getElementById(`card-${idx}`)?.querySelector('.actions')?.classList.add('hidden');
    });

    updateSummary();
    showToast(`Accepted ${ready.length} paragraphs ✓`);

  } catch (err) {
    showToast('Error during accept all: ' + err.message, true);
  }
}

/* -------------------------------------------------------
   Render
------------------------------------------------------- */
function renderAllCards() {
  const list = document.getElementById('paragraph-list');
  list.innerHTML = '';

  paragraphData.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'paragraph-card';
    card.id = `card-${i}`;
    card.innerHTML = `
      <div class="card-header">
        <span class="para-label">¶ ${i + 1}</span>
        <div class="card-header-right">
          <span class="status-badge status-pending">pending</span>
          <button class="btn-skip-sm" onclick="skipParagraph(${i})" title="Skip">✕</button>
        </div>
      </div>
      <div class="original-text">${escapeHtml(p.originalText)}</div>
      <p class="suggestion-label hidden">Suggested rewrite:</p>
      <div class="suggestion hidden"></div>
      <div class="actions hidden">
        <button class="btn-accept" onclick="acceptParagraph(${i})">Accept</button>
        <button class="btn-skip" onclick="skipParagraph(${i})">Skip</button>
      </div>
      <button class="humanize-btn btn-humanize" onclick="humanizeParagraphAt(${i})">Humanize</button>
    `;
    list.appendChild(card);
  });
}

function setCardStatus(i, status) {
  const card = document.getElementById(`card-${i}`);
  if (!card) return;
  const badge = card.querySelector('.status-badge');
  badge.className = `status-badge status-${status}`;
  badge.textContent = status;
  card.className = `paragraph-card card-${status}`;
}

function updateBtnState(i, enabled) {
  const btn = document.getElementById(`card-${i}`)?.querySelector('.humanize-btn');
  if (!btn) return;
  btn.disabled = !enabled;
  btn.textContent = enabled ? 'Humanize' : 'Working...';
}

function updateSummary() {
  const total = paragraphData.length;
  const accepted = paragraphData.filter(p => p.status === 'accepted').length;
  const ready = paragraphData.filter(p => p.status === 'ready').length;

  const bar = document.getElementById('summary-bar');
  bar.classList.remove('hidden');
  document.getElementById('summary-text').textContent =
    `${total} paragraphs  ·  ${ready} ready  ·  ${accepted} accepted`;
}

/* -------------------------------------------------------
   Progress helpers
------------------------------------------------------- */
function showProgress(pct, label) {
  document.getElementById('progress-section').classList.remove('hidden');
  document.getElementById('progress-fill').style.width = pct + '%';
  document.getElementById('progress-text').textContent = label;
}

function hideProgress() {
  document.getElementById('progress-section').classList.add('hidden');
}

/* -------------------------------------------------------
   Toast
------------------------------------------------------- */
function showToast(msg, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = 'toast' + (isError ? ' toast-error' : '');
  toast.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

/* -------------------------------------------------------
   Utilities
------------------------------------------------------- */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
