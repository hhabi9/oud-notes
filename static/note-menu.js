const noteMenu = $('#note-context-menu');
let contextNoteId = null;
function closeNoteMenu() { noteMenu.classList.add('hidden'); }
function openNoteMenu(event, card) {
  event.preventDefault();
  contextNoteId = Number(card.dataset.noteId);
  const note = noteById(contextNoteId);
  if (!note) return;
  $('#context-archive').textContent = note.archived ? 'Unarchive' : 'Archive';
  noteMenu.classList.remove('hidden');
  const rect = card.getBoundingClientRect();
  const x = event.type === 'keydown' ? rect.left + 20 : event.clientX;
  const y = event.type === 'keydown' ? rect.top + 20 : event.clientY;
  noteMenu.style.left = `${Math.max(8, Math.min(x, window.innerWidth - noteMenu.offsetWidth - 8))}px`;
  noteMenu.style.top = `${Math.max(8, Math.min(y, window.innerHeight - noteMenu.offsetHeight - 8))}px`;
  $('#context-archive').focus();
}
elements.noteList.addEventListener('contextmenu', (event) => {
  const card = event.target.closest('[data-note-id]');
  if (card) openNoteMenu(event, card);
});
elements.noteList.addEventListener('keydown', (event) => {
  const card = event.target.closest('[data-note-id]');
  if (card && (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10'))) openNoteMenu(event, card);
});
document.addEventListener('click', (event) => { if (!noteMenu.contains(event.target)) closeNoteMenu(); });
document.addEventListener('keydown', (event) => {
  if (noteMenu.classList.contains('hidden')) return;
  if (event.key === 'Escape') {
    closeNoteMenu();
    document.querySelector(`[data-note-id="${contextNoteId}"]`)?.focus();
  }
  if (['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    (document.activeElement === $('#context-archive') ? $('#context-delete') : $('#context-archive')).focus();
  }
});
window.addEventListener('resize', closeNoteMenu);
elements.noteList.addEventListener('scroll', closeNoteMenu);
$('#context-delete').addEventListener('click', () => { closeNoteMenu(); deleteCurrentNote(contextNoteId); });
$('#context-archive').addEventListener('click', async () => {
  const note = noteById(contextNoteId);
  closeNoteMenu();
  if (!note) return;
  try {
    await flushSaves();
    await api(`/api/notes/${note.id}`, { method: 'PATCH', body: JSON.stringify({ archived: !note.archived }) });
    await loadNotes();
    showToast(note.archived ? 'Note restored' : 'Note archived');
  } catch (error) { showToast(error.message); }
});
$('#archive-view').addEventListener('click', () => {
  state.archived = true; state.folder = ''; state.selectedId = null;
  elements.listTitle.textContent = 'Archive';
  $('#archive-view').classList.add('active');
  loadNotes().catch((error) => showToast(error.message));
});
