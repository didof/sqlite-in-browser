import { db, type Task } from "./db";

// ── DOM refs ─────────────────────────────────────────────────────────────────
const statusBanner = document.getElementById("status-banner")!;
const statusText = document.getElementById("status-text")!;
const taskForm = document.getElementById("task-form")!;
const taskInput = document.getElementById("task-input") as HTMLInputElement;
const taskList = document.getElementById("task-list")!;
const emptyState = document.getElementById("empty-state")!;
const listHeader = document.getElementById("list-header")!;
const taskCount = document.getElementById("task-count")!;
const perfFooter = document.getElementById("perf-footer")!;
const perfTime = document.getElementById("perf-time")!;

// ── Helpers ───────────────────────────────────────────────────────────────────
function setStatus(type: "loading" | "ready" | "error", message: string) {
    statusBanner.className = `status-banner status-${type}`;
    statusText.textContent = message;
}

function updatePerfTime(label: string, ms: number) {
    const display = ms < 1 ? `${(ms * 1000).toFixed(0)}µs` : `${ms.toFixed(2)}ms`;
    perfTime.textContent = `${label} — ${display}`;
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
    console.time(label);
    const t0 = performance.now();
    const result = await fn();
    const elapsed = performance.now() - t0;
    console.timeEnd(label);
    console.log(`[perf] ${label} took ${elapsed.toFixed(3)}ms`);
    updatePerfTime(label, elapsed);
    return result;
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderTasks(tasks: Task[]) {
    taskList.innerHTML = "";
    const count = tasks.length;
    taskCount.textContent = `${count} task${count !== 1 ? "s" : ""}`;

    if (count === 0) {
        emptyState.classList.remove("hidden");
        return;
    }
    emptyState.classList.add("hidden");

    for (const task of tasks) {
        taskList.appendChild(createTaskItem(task));
    }
}

function createTaskItem(task: Task): HTMLLIElement {
    const li = document.createElement("li");
    li.className = "task-item";
    li.dataset.id = String(task.id);

    // ── View mode ──────────────────────────────────────────────────────────────
    const viewRow = document.createElement("div");
    viewRow.className = "task-view-row";

    const idBadge = document.createElement("span");
    idBadge.className = "task-id";
    idBadge.textContent = `#${task.id}`;

    const textSpan = document.createElement("span");
    textSpan.className = "task-text";
    textSpan.textContent = task.text;

    const actions = document.createElement("div");
    actions.className = "task-actions";

    const editBtn = document.createElement("button");
    editBtn.className = "icon-btn edit-btn";
    editBtn.title = "Edit";
    editBtn.setAttribute("aria-label", `Edit task ${task.id}`);
    editBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "icon-btn delete-btn";
    deleteBtn.title = "Delete";
    deleteBtn.setAttribute("aria-label", `Delete task ${task.id}`);
    deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;

    actions.append(editBtn, deleteBtn);
    viewRow.append(idBadge, textSpan, actions);

    // ── Edit mode ──────────────────────────────────────────────────────────────
    const editRow = document.createElement("div");
    editRow.className = "task-edit-row hidden";

    const editInput = document.createElement("input");
    editInput.type = "text";
    editInput.className = "edit-input";
    editInput.value = task.text;
    editInput.maxLength = 200;

    const saveBtn = document.createElement("button");
    saveBtn.className = "icon-btn save-btn";
    saveBtn.title = "Save";
    saveBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "icon-btn cancel-btn";
    cancelBtn.title = "Cancel";
    cancelBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

    const editActions = document.createElement("div");
    editActions.className = "task-actions";
    editActions.append(saveBtn, cancelBtn);

    editRow.append(editInput, editActions);
    li.append(viewRow, editRow);

    // ── Event wiring ───────────────────────────────────────────────────────────
    function enterEditMode() {
        viewRow.classList.add("hidden");
        editRow.classList.remove("hidden");
        editInput.focus();
        editInput.select();
    }

    function exitEditMode() {
        editRow.classList.add("hidden");
        viewRow.classList.remove("hidden");
    }

    editBtn.addEventListener("click", enterEditMode);
    cancelBtn.addEventListener("click", exitEditMode);
    editInput.addEventListener("keydown", (e) => {
        if (e.key === "Escape") exitEditMode();
    });

    async function saveEdit() {
        const newText = editInput.value.trim();
        if (!newText || newText === task.text) { exitEditMode(); return; }
        await timed("updateTask", () => db.updateTask(task.id, newText));
        await loadTasks();
    }

    saveBtn.addEventListener("click", saveEdit);
    editInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveEdit();
    });

    deleteBtn.addEventListener("click", async () => {
        li.classList.add("task-removing");
        li.addEventListener("animationend", async () => {
            await timed("deleteTask", () => db.deleteTask(task.id));
            await loadTasks();
        }, { once: true });
    });

    return li;
}

// ── Data ops ──────────────────────────────────────────────────────────────────
async function loadTasks() {
    const tasks = await timed("getTasks", () => db.getTasks() as Promise<Task[]>);
    renderTasks(tasks);
    listHeader.classList.toggle("hidden", tasks.length === 0);
    perfFooter.classList.remove("hidden");
}

async function handleSubmit(e: Event) {
    e.preventDefault();
    const text = taskInput.value.trim();
    if (!text) return;
    taskInput.value = "";
    taskInput.focus();
    await timed("insertTask", () => db.insertTask(text));
    await loadTasks();
}

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
    setStatus("loading", "Initializing SQLite WASM & OPFS…");
    try {
        await db.initDb();
        setStatus("ready", "SQLite ready — data persists locally via OPFS");
        taskForm.classList.remove("hidden");
        listHeader.classList.remove("hidden");
        await loadTasks();
        taskForm.addEventListener("submit", handleSubmit);
        taskInput.focus();
    } catch (err: any) {
        console.error("Init failed:", err);
        setStatus("error", `Failed to initialize: ${err.message ?? "Unknown error"}`);
    }
}

init();
