const state = {
  notes: [],
  selectedId: null,
  folder: '',
  archived: false,
  search: '',
  saveTimers: new Map(),
  requestVersions: new Map(),
  preview: false,
  saveQueues: new Map(),
};

const draftKey = 'oud-pending-edits';
let drafts = {};
try {
  const stored = JSON.parse(localStorage.getItem(draftKey) || '{}');
  if (stored && typeof stored === 'object' && !Array.isArray(stored)) drafts = stored;
} catch (error) {
  // A damaged recovery record must not prevent the editor from opening.
}

function persistDrafts() {
  localStorage.setItem(draftKey, JSON.stringify(drafts));
}

function withDraft(note) {
  const merged = { ...note, ...drafts[note.id] };
  if (typeof merged.tags === 'string') merged.tags = merged.tags.split(',').map((tag) => tag.trim()).filter(Boolean);
  return merged;
}

marked.use({ gfm: true, breaks: false });
marked.use(markedFootnote());
marked.use(markedKatex({ throwOnError: false, nonStandard: true }));

function initializeMermaid() {
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    theme: ['dark', 'forest', 'midnight'].includes(document.documentElement.dataset.theme) ? 'dark' : 'neutral',
  });
}

initializeMermaid();

const $ = (selector) => document.querySelector(selector);
const elements = {
  noteList: $('#note-list'),
  editor: $('#editor'),
  emptyState: $('#empty-state'),
  title: $('#note-title'),
  content: $('#note-content'),
  folder: $('#note-folder'),
  tags: $('#note-tags'),
  folderList: $('#folder-list'),
  folderOptions: $('#folder-options'),
  allCount: $('#all-count'),
  noteTotal: $('#note-total'),
  listTitle: $('#list-title'),
  search: $('#search'),
  saveState: $('#save-state'),
  pin: $('#pin-note'),
  preview: $('#markdown-preview'),
  previewToggle: $('#preview-toggle'),
  updatedTime: $('#updated-time'),
  wordCount: $('#word-count'),
  editorColumn: $('#editor-column'),
  sidebar: $('#sidebar'),
  toast: $('#toast'),
};

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add('show');
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => elements.toast.classList.remove('show'), 2200);
}

function escapeHtml(value = '') {
  const span = document.createElement('span');
  span.textContent = value;
  return span.innerHTML.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let previewRenderVersion = 0;

async function renderMarkdown(source) {
  const renderVersion = ++previewRenderVersion;
  try {
    const html = DOMPurify.sanitize(marked.parse(source));
    if (renderVersion !== previewRenderVersion) return;
    elements.preview.innerHTML = html;

    elements.preview.querySelectorAll('a').forEach((link) => {
      if (/^https?:\/\//i.test(link.href)) {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
    });

    const diagrams = [];
    elements.preview.querySelectorAll('pre code.language-mermaid').forEach((code) => {
      const diagram = document.createElement('div');
      diagram.className = 'mermaid';
      diagram.textContent = code.textContent;
      code.closest('pre').replaceWith(diagram);
      diagrams.push(diagram);
    });

    elements.preview.querySelectorAll('pre code').forEach((code) => hljs.highlightElement(code));
    if (diagrams.length) await mermaid.run({ nodes: diagrams, suppressErrors: true });
  } catch (error) {
    if (renderVersion !== previewRenderVersion) return;
    elements.preview.innerHTML = `<p class="preview-error">Preview error: ${escapeHtml(error.message)}</p>`;
  }
}

function relativeTime(isoDate) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(isoDate).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(isoDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function noteById(id = state.selectedId) {
  return state.notes.find((note) => note.id === id);
}

function renderNotes() {
  elements.noteTotal.textContent = `${state.notes.length} ${state.notes.length === 1 ? 'note' : 'notes'}`;
  if (!state.notes.length) {
    elements.noteList.innerHTML = `<div class="list-empty">${state.search ? 'No notes match your search.' : 'No notes here yet.'}</div>`;
    return;
  }
  elements.noteList.innerHTML = state.notes.map((note) => {
    const snippet = note.content.replace(/[#*_>`-]/g, '').trim() || 'No additional text';
    const tags = note.tags.slice(0, 2).map((tag) => `<span class="tag-pill">${escapeHtml(tag)}</span>`).join('');
    return `
      <button class="note-card ${note.id === state.selectedId ? 'active' : ''}" data-note-id="${note.id}">
        <div class="note-card-top">
          <h3>${escapeHtml(note.title)}</h3>
          ${note.pinned ? '<span class="pin-indicator" title="Pinned">◆</span>' : ''}
        </div>
        <p class="note-snippet">${escapeHtml(snippet)}</p>
        <div class="note-card-footer">
          <span>${relativeTime(note.updated_at)}</span>${tags}
        </div>
      </button>`;
  }).join('');
}

function renderFolders(allNotes) {
  const counts = new Map();
  allNotes.forEach((note) => {
    if (note.folder) counts.set(note.folder, (counts.get(note.folder) || 0) + 1);
  });
  elements.allCount.textContent = allNotes.length;
  elements.folderList.innerHTML = [...counts.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([folder, count]) => `
    <button class="folder-link ${state.folder === folder ? 'active' : ''}" data-folder="${escapeHtml(folder)}">
      <span><span class="folder-icon">◇</span>${escapeHtml(folder)}</span><span class="count">${count}</span>
    </button>`).join('');
  elements.folderOptions.innerHTML = [...counts.keys()].map((folder) => `<option value="${escapeHtml(folder)}"></option>`).join('');
  document.querySelector('[data-folder=""]').classList.toggle('active', !state.folder && !state.archived);
}

function fillEditor(note) {
  if (!note) {
    elements.editor.classList.add('hidden');
    elements.emptyState.classList.remove('hidden');
    return;
  }
  note = withDraft(note);
  elements.emptyState.classList.add('hidden');
  elements.editor.classList.remove('hidden');
  elements.title.value = note.title;
  elements.content.value = note.content;
  elements.folder.value = note.folder;
  elements.tags.value = note.tags.join(', ');
  elements.pin.textContent = note.pinned ? '◆' : '♧';
  elements.pin.title = note.pinned ? 'Unpin note' : 'Pin note';
  elements.updatedTime.textContent = `Updated ${relativeTime(note.updated_at)}`;
  updateWordCount();
  if (state.preview) renderMarkdown(note.content);
}

async function loadNotes({ preserveSelection = true } = {}) {
  const params = new URLSearchParams();
  if (state.archived) params.set('archived', 'true');
  if (state.search) params.set('q', state.search);
  if (state.folder) params.set('folder', state.folder);
  const [notes, allNotes] = await Promise.all([
    api(`/api/notes?${params}`),
    state.search || state.folder || state.archived ? api('/api/notes') : Promise.resolve(null),
  ]);
  state.notes = notes.map(withDraft);
  renderFolders(allNotes || notes);
  if (preserveSelection && state.selectedId && !noteById()) state.selectedId = null;
  renderNotes();
  fillEditor(noteById());
}

async function createNote() {
  try {
    state.archived = false;
    $('#archive-view').classList.remove('active');
    elements.listTitle.textContent = state.folder || 'All notes';
    const note = await api('/api/notes', {
      method: 'POST',
      body: JSON.stringify({ folder: state.folder }),
    });
    state.search = '';
    elements.search.value = '';
    state.selectedId = note.id;
    await loadNotes();
    elements.editorColumn.classList.add('open');
    elements.title.focus();
    elements.title.select();
  } catch (error) { showToast(error.message); }
}

function updateWordCount() {
  const words = elements.content.value.trim().match(/\S+/g)?.length || 0;
  elements.wordCount.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
}

function scheduleSave() {
  const id = state.selectedId;
  if (!id) return;
  elements.saveState.classList.add('saving');
  elements.saveState.lastChild.textContent = ' Saving…';
  clearTimeout(state.saveTimers.get(id));
  const requestVersion = (state.requestVersions.get(id) || 0) + 1;
  state.requestVersions.set(id, requestVersion);
  const payload = {
    title: elements.title.value,
    content: elements.content.value,
    folder: elements.folder.value,
    tags: elements.tags.value,
  };
  drafts[id] = payload;
  try {
    persistDrafts();
  } catch (error) {
    showToast('Local recovery unavailable; keep the app open until Saved.');
  }
  state.saveTimers.set(id, setTimeout(() => {
    state.saveTimers.delete(id);
    queueSave(id, payload, requestVersion).catch(() => {});
  }, 550));
}

function queueSave(id, payload, requestVersion) {
  const previous = state.saveQueues.get(id) || Promise.resolve();
  const pending = previous.catch(() => {}).then(() => saveNote(id, payload, requestVersion)).finally(() => {
    if (state.saveQueues.get(id) === pending) state.saveQueues.delete(id);
  });
  state.saveQueues.set(id, pending);
  return pending;
}

async function flushSaves() {
  for (const [id, payload] of Object.entries(drafts)) {
    const noteId = Number(id);
    clearTimeout(state.saveTimers.get(noteId));
    state.saveTimers.delete(noteId);
    queueSave(noteId, payload, state.requestVersions.get(noteId)).catch(() => {});
  }
  await Promise.all(state.saveQueues.values());
}

async function saveNote(id, payload, requestVersion) {
  try {
    const saved = await api(`/api/notes/${id}`, { method: 'PATCH', body: JSON.stringify(payload) });
    if (requestVersion !== state.requestVersions.get(id)) return;
    delete drafts[id];
    persistDrafts();
    const index = state.notes.findIndex((note) => note.id === id);
    if (index >= 0) state.notes[index] = saved;
    if (id === state.selectedId) {
      elements.saveState.classList.remove('saving');
      elements.saveState.lastChild.textContent = ' Saved';
      elements.updatedTime.textContent = 'Updated just now';
    }
    renderNotes();
    const allNotes = await api('/api/notes');
    renderFolders(allNotes);
  } catch (error) {
    if (id === state.selectedId) elements.saveState.lastChild.textContent = ' Save failed';
    showToast(error.message);
    throw error;
  }
}

async function deleteCurrentNote(id = state.selectedId) {
  const note = noteById(id);
  if (!note || !confirm(`Delete “${note.title}”? This cannot be undone.`)) return;
  try {
    clearTimeout(state.saveTimers.get(note.id));
    state.saveTimers.delete(note.id);
    await (state.saveQueues.get(note.id) || Promise.resolve()).catch(() => {});
    await api(`/api/notes/${note.id}`, { method: 'DELETE' });
    delete drafts[note.id];
    persistDrafts();
    if (state.selectedId === note.id) state.selectedId = null;
    await loadNotes();
    elements.editorColumn.classList.remove('open');
    showToast('Note deleted');
  } catch (error) { showToast(error.message); }
}

async function togglePin() {
  const note = noteById();
  if (!note) return;
  try {
    await api(`/api/notes/${note.id}`, {
      method: 'PATCH', body: JSON.stringify({ pinned: !note.pinned }),
    });
    await loadNotes();
  } catch (error) { showToast(error.message); }
}

function togglePreview() {
  state.preview = !state.preview;
  elements.previewToggle.textContent = state.preview ? 'Write' : 'Preview';
  elements.content.classList.toggle('hidden', state.preview);
  elements.preview.classList.toggle('hidden', !state.preview);
  if (state.preview) renderMarkdown(elements.content.value);
}

elements.noteList.addEventListener('click', (event) => {
  const card = event.target.closest('[data-note-id]');
  if (!card) return;
  state.selectedId = Number(card.dataset.noteId);
  renderNotes();
  fillEditor(noteById());
  elements.editorColumn.classList.add('open');
});

document.addEventListener('click', (event) => {
  const folderLink = event.target.closest('[data-folder]');
  if (!folderLink) return;
  state.folder = folderLink.dataset.folder;
  state.archived = false;
  $('#archive-view').classList.remove('active');
  state.selectedId = null;
  elements.listTitle.textContent = state.folder || 'All notes';
  elements.sidebar.classList.remove('open');
  loadNotes();
});

['#new-note', '#empty-new-note'].forEach((selector) => $(selector).addEventListener('click', createNote));
['input', 'change'].forEach((eventName) => {
  [elements.title, elements.content, elements.folder, elements.tags].forEach((input) => input.addEventListener(eventName, () => {
    if (input === elements.content) updateWordCount();
    scheduleSave();
  }));
});

let searchTimer;
elements.search.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = elements.search.value.trim();
    state.selectedId = null;
    loadNotes();
  }, 220);
});

$('#delete-note').addEventListener('click', () => deleteCurrentNote());
elements.pin.addEventListener('click', togglePin);
elements.previewToggle.addEventListener('click', togglePreview);
$('#export-note').addEventListener('click', async () => {
  if (!state.selectedId) return;
  const id = state.selectedId;
  try {
    await flushSaves();
  } catch (error) {
    showToast('Could not save the latest edits. Export cancelled.');
    return;
  }
  const link = document.createElement('a');
  link.href = `/api/notes/${id}/export`;
  link.download = '';
  link.click();
});
$('#theme-toggle').addEventListener('click', () => {
  const themes = ['light', 'sepia', 'ocean', 'dark', 'forest', 'midnight'];
  const theme = themes[(themes.indexOf(document.documentElement.dataset.theme) + 1) % themes.length];
  document.documentElement.dataset.theme = theme;
  localStorage.setItem('oud-theme', theme);
  initializeMermaid();
  if (state.preview) renderMarkdown(elements.content.value);
});
$('#open-sidebar').addEventListener('click', () => elements.sidebar.classList.add('open'));
$('#close-sidebar').addEventListener('click', () => elements.sidebar.classList.remove('open'));
$('#back-to-list').addEventListener('click', () => elements.editorColumn.classList.remove('open'));

document.addEventListener('keydown', (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
    event.preventDefault(); createNote();
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault(); elements.search.focus();
  }
});

async function startApp() {
  const notes = await api('/api/notes?archived=all');
  const existingIds = new Set(notes.map((note) => String(note.id)));
  for (const id of Object.keys(drafts)) {
    if (!existingIds.has(id)) delete drafts[id];
  }
  persistDrafts();
  await flushSaves();
  await loadNotes();
}

startApp().catch((error) => {
  showToast(error.message);
  loadNotes().catch((loadError) => showToast(loadError.message));
});
