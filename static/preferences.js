const fontChoices = { serif: 'Georgia, serif', sans: 'ui-sans-serif, sans-serif', mono: 'ui-monospace, monospace' };
let preferences = { font: 'serif', zoom: 100 };
try { preferences = { ...preferences, ...JSON.parse(localStorage.getItem('oud-preferences') || '{}') }; } catch {}
function applyPreferences() {
  if (!fontChoices[preferences.font]) preferences.font = 'serif';
  preferences.zoom = Math.max(50, Math.min(200, Number(preferences.zoom) || 100));
  document.documentElement.style.setProperty('--writing-font', fontChoices[preferences.font]);
  document.documentElement.style.setProperty('--note-zoom', preferences.zoom / 100);
  $('#pref-font').value = preferences.font;
  $('#zoom-reset').textContent = `${preferences.zoom}%`;
  $('#zoom-out').disabled = preferences.zoom <= 50;
  $('#zoom-in').disabled = preferences.zoom >= 200;
}
function savePreferences() {
  applyPreferences();
  try { localStorage.setItem('oud-preferences', JSON.stringify(preferences)); }
  catch { showToast('Could not remember preferences on this device.'); }
}
function openPreferences() {
  $('#pref-theme').value = document.documentElement.dataset.theme;
  $('#preferences').showModal();
}
$('#preferences-open').addEventListener('click', openPreferences);
$('#pref-font').addEventListener('change', (event) => { preferences.font = event.target.value; savePreferences(); });
$('#pref-theme').addEventListener('change', (event) => {
  document.documentElement.dataset.theme = event.target.value;
  localStorage.setItem('oud-theme', event.target.value);
  initializeMermaid();
  if (state.preview) renderMarkdown(elements.content.value);
});
function changeZoom(amount) { preferences.zoom += amount; savePreferences(); }
$('#zoom-in').addEventListener('click', () => changeZoom(10));
$('#zoom-out').addEventListener('click', () => changeZoom(-10));
$('#zoom-reset').addEventListener('click', () => { preferences.zoom = 100; savePreferences(); });
document.addEventListener('keydown', (event) => {
  if (!(event.metaKey || event.ctrlKey)) return;
  if (event.key === ',') { event.preventDefault(); openPreferences(); }
  if (['+', '=', '-', '0'].includes(event.key)) {
    event.preventDefault();
    if (event.key === '0') preferences.zoom = 100;
    else preferences.zoom += event.key === '-' ? -10 : 10;
    savePreferences();
  }
});
$('#export-backup').addEventListener('click', async () => {
  try {
    await flushSaves();
    const link = document.createElement('a');
    link.href = '/api/backup'; link.download = ''; link.click();
    $('#transfer-status').textContent = 'Backup download requested.';
  } catch { $('#transfer-status').textContent = 'Save failed. Please retry before exporting.'; }
});
$('#import-open').addEventListener('click', () => $('#import-files').click());
$('#import-files').addEventListener('change', async (event) => {
  const files = [...event.target.files];
  if (!files.length) return;
  $('#import-open').disabled = true;
  try {
    const notes = [];
    for (const file of files) {
      if (file.size > 20 * 1024 * 1024) throw new Error('Each file must be smaller than 20 MB.');
      const content = await file.text();
      if (/\.json$/i.test(file.name)) {
        const backup = JSON.parse(content);
        if (backup.format !== 'oud-notes' || backup.version !== 1 || !Array.isArray(backup.notes)) throw new Error('Invalid Oud Notes backup.');
        notes.push(...backup.notes);
      } else if (/\.(md|markdown|txt)$/i.test(file.name)) {
        notes.push({ title: file.name.replace(/\.[^.]+$/, ''), content, folder: state.folder, tags: [] });
      } else throw new Error('Choose Markdown, text, or Oud Notes JSON files.');
    }
    await flushSaves();
    const result = await api('/api/import', { method: 'POST', body: JSON.stringify({ format: 'oud-notes', version: 1, notes }) });
    state.search = ''; state.folder = ''; elements.search.value = ''; elements.listTitle.textContent = 'All notes';
    await loadNotes();
    $('#transfer-status').textContent = `Imported ${result.imported} notes.`;
  } catch (error) { $('#transfer-status').textContent = error.message; }
  finally { event.target.value = ''; $('#import-open').disabled = false; }
});
applyPreferences();
