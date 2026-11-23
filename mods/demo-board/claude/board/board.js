const $ = (id) => document.getElementById(id);
const state = { steps: [], notes: [], db: null };
const TRASH_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3 4h10M6.5 4V2.5h3V4M4.5 4l.6 9.5h5.8l.6-9.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  Object.assign(node, attrs || {});
  for (const child of children || []) if (child) node.append(child);
  return node;
}

function setStatus(text) {
  $("status").textContent = text;
}

async function save(ref, write) {
  try {
    await write(ref);
  } catch (e) {
    setStatus(e?.code === "invalid_argument" ? "You can view this board but not change it." : "That change did not save. Try again.");
  }
}

function noteEditor(step, ref) {
  const input = el("input", { className: "step-note", id: `note-${step.id}`, value: step.note || "", placeholder: "What should change? Enter saves it" });
  const commit = () => {
    state.editing = null;
    save(ref, (r) => r.update({ note: input.value.trim() }));
    renderSteps();
  };
  input.onkeydown = (e) => { if (e.key === "Enter") commit(); };
  return [input, el("button", { textContent: "Save", onclick: commit })];
}

function changeNote(step) {
  const edit = el("button", { textContent: "Edit", onclick: () => { state.editing = step.id; state.focusStep = step.id; renderSteps(); } });
  const text = el("p", { className: "change-note" }, [el("b", { textContent: "To change: " }), step.note]);
  return [text, edit];
}

function stepActions(step) {
  const ref = state.db.collection("steps").doc(step.id);
  const undo = el("button", { textContent: "Undo", onclick: () => save(ref, (r) => r.update({ status: "todo" })) });
  if (step.status === "approved") return el("div", { className: "actions" }, [undo]);
  const approve = el("button", { className: "approve", textContent: "Approved", onclick: () => save(ref, (r) => r.update({ status: "approved" })) });
  if (step.status === "changes") {
    const editing = state.editing === step.id || !step.note;
    return el("div", { className: "actions" }, [approve, undo, ...(editing ? noteEditor(step, ref) : changeNote(step))]);
  }
  const change = el("button", { className: "change", textContent: "Changes asked", onclick: () => {
    state.editing = step.id;
    state.focusStep = step.id;
    save(ref, (r) => r.update({ status: "changes" }));
  } });
  return el("div", { className: "actions" }, [approve, change]);
}

function clearApproved(button) {
  const done = state.steps.filter((s) => s.status === "approved");
  if (button.dataset.armed !== "1") {
    button.dataset.armed = "1";
    button.textContent = `Click again to delete ${done.length}`;
    setTimeout(() => { button.dataset.armed = ""; button.textContent = "Delete approved"; }, 4000);
    return;
  }
  for (const step of done) save(state.db.collection("steps").doc(step.id), (r) => r.delete());
}

function stepItem(step) {
  const head = el("div", { className: "step-head" }, [
    step.pr ? el("span", { className: "pr", textContent: step.pr }) : null,
    el("span", { className: "step-title", textContent: step.title || "Untitled step" }),
    step.status === "changes" ? el("span", { className: "pill", textContent: "Changes asked" }) : null,
  ]);
  const how = step.how ? el("p", { className: "how", textContent: step.how }) : null;
  return el("li", { className: `step ${step.status}` }, [head, how, stepActions(step)]);
}

function renderSteps() {
  const drafts = [...document.querySelectorAll(".step-note")].map((input) => [input.id, input.value]);
  const focused = state.focusStep ? `note-${state.focusStep}` : document.activeElement?.id;
  state.focusStep = null;
  const of = (status) => state.steps.filter((s) => s.status === status);
  const open = of("todo"), changes = of("changes"), done = of("approved");
  $("todo").replaceChildren(...open.map(stepItem));
  $("changes").replaceChildren(...changes.map(stepItem));
  $("done").replaceChildren(...done.map(stepItem));
  $("todo-count").textContent = open.length ? String(open.length) : "";
  $("changes-count").textContent = String(changes.length);
  $("done-count").textContent = String(done.length);
  $("todo-empty").hidden = open.length > 0;
  $("changes-box").hidden = changes.length === 0;
  $("done-box").hidden = done.length === 0;
  for (const [id, value] of drafts) if ($(id)) $(id).value = value;
  if (focused && $(focused)) $(focused).focus();
}

function noteItem(note) {
  const time = note.at ? new Date(note.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  return el("li", { className: `note${note.read ? " read" : ""}` }, [
    el("span", { className: "note-time", textContent: time }),
    el("span", { className: "note-text", textContent: note.text }),
    note.read ? el("span", { className: "note-tag", textContent: "Claude read it" }) : null,
    deleteNoteButton(note),
  ]);
}

function deleteNoteButton(note) {
  const button = el("button", { className: "icon", type: "button", title: "Delete note", ariaLabel: "Delete note", innerHTML: TRASH_ICON });
  button.onclick = () => {
    if (button.dataset.armed !== "1") {
      button.dataset.armed = "1";
      button.textContent = "Delete?";
      setTimeout(() => { button.dataset.armed = ""; button.innerHTML = TRASH_ICON; }, 4000);
      return;
    }
    save(state.db.collection("notes").doc(note.id), (r) => r.delete());
  };
  return button;
}

function renderNotes() {
  $("note-list").replaceChildren(...state.notes.map(noteItem));
  $("notes-empty").hidden = state.notes.length > 0;
}

function listen(query, onDocs) {
  const timer = setTimeout(() => setStatus("Can't reach the board yet. It shows up once the connection is back."), 10000);
  query.onSnapshot((snap) => {
    if (!snap.metadata.fromCache) { clearTimeout(timer); setStatus(""); }
    onDocs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, () => { clearTimeout(timer); setStatus("The board stopped updating. Reload the page."); });
}

function addNote(event) {
  event.preventDefault();
  const input = $("note-input"), text = input.value.trim();
  if (!text || !state.db) return;
  input.value = "";
  save(state.db.collection("notes"), (c) => c.add({ text, at: new Date().toISOString(), read: false }));
}

async function start() {
  renderSteps();
  renderNotes();
  $("note-form").addEventListener("submit", addNote);
  $("clear-done").addEventListener("click", (e) => clearApproved(e.currentTarget));
  const db = await window.claude?.use?.("db");
  if (!db) { $("project").textContent = "Demo board"; setStatus("Sign in to claude.ai to see this board."); return; }
  state.db = db;
  db.doc("meta/board").onSnapshot((snap) => { $("project").textContent = snap.data()?.project || "Demo board"; });
  listen(db.collection("steps").orderBy("added"), (steps) => { state.steps = steps; renderSteps(); });
  listen(db.collection("notes").orderBy("at", "desc"), (notes) => { state.notes = notes; renderNotes(); });
}

start();
