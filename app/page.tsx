"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ArrowDownUp,
  BarChart3,
  Bell,
  BookOpen,
  Calendar,
  CheckCircle,
  ClipboardCheck,
  ExternalLink,
  Filter,
  Flag,
  Loader2,
  Pencil,
  PlusCircle,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import {
  filterOptions,
  priorityOptions,
  priorityStyles,
  studyFlowApi,
  TaskCollection,
  TaskDeadline,
  TaskInputFactory,
  TaskMetrics,
  type FilterStatus,
  type SortMode,
  type Task,
  type TaskInput,
  type TaskPriority,
  type TaskStatus,
} from "./lib/studyflow";

export default function Home() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [processingTaskId, setProcessingTaskId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("Sedang");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSubject, setEditSubject] = useState("");
  const [editStatus, setEditStatus] = useState<TaskStatus>("Belum");
  const [editPriority, setEditPriority] = useState<TaskPriority>("Sedang");
  const [editDueDate, setEditDueDate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("Semua");
  const [sortMode, setSortMode] = useState<SortMode>("deadline");

  const todayKey = useMemo(() => TaskDeadline.todayKey(), []);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await studyFlowApi.listTasks();
      setTasks(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengambil data dari server");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    studyFlowApi
      .listTasks()
      .then((data) => {
        if (!isMounted) return;
        setTasks(data);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Gagal mengambil data dari server");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const dashboard = useMemo(() => TaskMetrics.dashboard(tasks, todayKey), [tasks, todayKey]);
  const reminders = useMemo(
    () => TaskCollection.reminders(tasks, todayKey),
    [tasks, todayKey],
  );
  const filteredTasks = useMemo(
    () => TaskCollection.filterAndSort(tasks, searchTerm, filterStatus, sortMode, todayKey),
    [filterStatus, searchTerm, sortMode, tasks, todayKey],
  );

  const resetCreateForm = () => {
    setTitle("");
    setSubject("");
    setPriority("Sedang");
    setDueDate("");
    setNotes("");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const nextTask = TaskInputFactory.create(title, subject, priority, dueDate, notes);
    if (!nextTask.title || !nextTask.subject) return;

    try {
      setSubmitting(true);
      const newTask = await studyFlowApi.createTask(nextTask);
      setTasks((currentTasks) => [...currentTasks, newTask]);
      resetCreateForm();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambahkan task");
    } finally {
      setSubmitting(false);
    }
  };

  const startEdit = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title);
    setEditSubject(task.subject);
    setEditStatus(task.status);
    setEditPriority(task.priority);
    setEditDueDate(task.dueDate);
    setEditNotes(task.notes);
  };

  const cancelEdit = () => {
    setEditingTaskId(null);
    setEditTitle("");
    setEditSubject("");
    setEditStatus("Belum");
    setEditPriority("Sedang");
    setEditDueDate("");
    setEditNotes("");
  };

  const updateTask = async (taskId: string, input: Partial<TaskInput>) => {
    setProcessingTaskId(taskId);

    try {
      const updatedTask = await studyFlowApi.updateTask(taskId, input);
      setTasks((currentTasks) =>
        currentTasks.map((task) => (task.id === taskId ? updatedTask : task)),
      );
      setError(null);
      return updatedTask;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah task");
      return null;
    } finally {
      setProcessingTaskId(null);
    }
  };

  const handleEditSubmit = async (e: FormEvent<HTMLFormElement>, taskId: string) => {
    e.preventDefault();
    const nextTask = TaskInputFactory.create(
      editTitle,
      editSubject,
      editPriority,
      editDueDate,
      editNotes,
      editStatus,
    );

    if (!nextTask.title || !nextTask.subject) return;

    const updatedTask = await updateTask(taskId, nextTask);
    if (updatedTask) cancelEdit();
  };

  const toggleTaskStatus = async (task: Task) => {
    await updateTask(task.id, {
      status: task.status === "Selesai" ? "Belum" : "Selesai",
    });
  };

  const deleteTask = async (taskId: string) => {
    const shouldDelete = window.confirm("Hapus task ini?");
    if (!shouldDelete) return;

    setProcessingTaskId(taskId);

    try {
      await studyFlowApi.deleteTask(taskId);
      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
      if (editingTaskId === taskId) cancelEdit();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus task");
    } finally {
      setProcessingTaskId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <nav className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-white">StudyFlow</h1>
              <p className="text-xs text-slate-400">Task belajar, reminder, dan Pomodoro.</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300 sm:flex">
            <BarChart3 className="h-4 w-4 text-blue-400" />
            {dashboard.progress}% selesai
          </div>
        </div>
      </nav>

      <main className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-5 py-6 lg:grid-cols-[360px_1fr]">
        <section className="space-y-6">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                  Dashboard
                </h2>
                <p className="mt-1 text-sm text-slate-500">Ringkasan progres belajar.</p>
              </div>
              <span className="rounded-lg bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-300">
                {dashboard.progress}%
              </span>
            </div>

            <div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${dashboard.progress}%` }}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total task" value={dashboard.total} />
              <StatCard label="Selesai" value={dashboard.completed} tone="emerald" />
              <StatCard label="Hari ini" value={dashboard.dueToday} tone="amber" />
              <StatCard label="Terlambat" value={dashboard.overdue} tone="red" />
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <Bell className="h-5 w-5 text-amber-300" />
              Reminder Deadline
            </h2>
            {reminders.length === 0 ? (
              <p className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 text-sm text-slate-400">
                Tidak ada task yang deadline hari ini atau terlambat.
              </p>
            ) : (
              <div className="space-y-2">
                {reminders.slice(0, 4).map((task) => {
                  const deadlineMeta = TaskDeadline.meta(task, todayKey);
                  return (
                    <Link
                      key={task.id}
                      href={`/tasks/${task.id}`}
                      className="block rounded-lg border border-slate-800 bg-slate-950 px-3 py-3 transition-colors hover:border-amber-500/40"
                    >
                      <p className="text-sm font-medium text-white">{task.title}</p>
                      <p className="mt-1 text-xs text-slate-400">{task.subject}</p>
                      <span
                        className={`mt-2 inline-flex rounded-full border px-2 py-1 text-xs ${deadlineMeta.className}`}
                      >
                        {deadlineMeta.label}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <PlusCircle className="h-5 w-5 text-blue-400" />
              Tambah Task
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Nama Task">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Baca jurnal"
                  className={inputClassName}
                  required
                />
              </Field>

              <Field label="Mata Kuliah">
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Contoh: Metodologi Penelitian"
                  className={inputClassName}
                  required
                />
              </Field>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Prioritas">
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TaskPriority)}
                    className={inputClassName}
                  >
                    {priorityOptions.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Deadline">
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={inputClassName}
                  />
                </Field>
              </div>

              <Field label="Catatan">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Fokus ke bab 2 dan latihan soal."
                  rows={3}
                  maxLength={500}
                  className={`${inputClassName} resize-none`}
                />
              </Field>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-900 disabled:text-slate-400"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="h-4 w-4" />
                )}
                {submitting ? "Menyimpan..." : "Simpan Task"}
              </button>
            </form>
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Daftar Task</h2>
                <p className="text-sm text-slate-400">
                  {filteredTasks.length} dari {dashboard.total} task ditampilkan.
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <BookOpen className="h-4 w-4 text-blue-400" />
                {dashboard.subjects} mata kuliah
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1fr_180px_180px]">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Cari nama task, mata kuliah, atau catatan"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
                />
              </label>

              <label className="relative block">
                <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                  className="w-full appearance-none rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-blue-500"
                >
                  {filterOptions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="relative block">
                <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <select
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value as SortMode)}
                  className="w-full appearance-none rounded-lg border border-slate-800 bg-slate-950 py-2.5 pl-10 pr-4 text-sm text-white outline-none focus:border-blue-500"
                >
                  <option value="deadline">Deadline</option>
                  <option value="priority">Prioritas</option>
                  <option value="newest">Terbaru</option>
                  <option value="subject">Mata kuliah</option>
                </select>
              </label>
            </div>
          </div>

          {error ? (
            <ErrorBanner message={error} onRetry={fetchTasks} />
          ) : null}

          {loading ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-slate-800 bg-slate-900 py-16 text-slate-400">
              <Loader2 className="mb-4 h-8 w-8 animate-spin text-blue-400" />
              <p>Memuat task...</p>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-800 bg-slate-900 py-14 text-center">
              <CheckCircle className="mb-4 h-11 w-11 text-slate-600" />
              <h3 className="text-lg font-medium text-white">Tidak ada task yang cocok</h3>
              <p className="mt-1 text-sm text-slate-400">
                Tambah task baru atau ubah filter pencarian.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  todayKey={todayKey}
                  editing={editingTaskId === task.id}
                  processing={processingTaskId === task.id}
                  editState={{
                    title: editTitle,
                    subject: editSubject,
                    status: editStatus,
                    priority: editPriority,
                    dueDate: editDueDate,
                    notes: editNotes,
                  }}
                  setEditState={{
                    setTitle: setEditTitle,
                    setSubject: setEditSubject,
                    setStatus: setEditStatus,
                    setPriority: setEditPriority,
                    setDueDate: setEditDueDate,
                    setNotes: setEditNotes,
                  }}
                  onStartEdit={startEdit}
                  onCancelEdit={cancelEdit}
                  onSubmitEdit={handleEditSubmit}
                  onToggleStatus={toggleTaskStatus}
                  onDelete={deleteTask}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-5 py-8 text-center text-sm text-slate-500">
        <p>StudyFlow &copy; {new Date().getFullYear()} - Project Next.js & Node.js</p>
      </footer>
    </div>
  );
}

const inputClassName =
  "w-full rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-slate-600 focus:border-blue-500";

function Field({
  label,
  children,
}: Readonly<{
  label: string;
  children: ReactNode;
}>) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: Readonly<{
  label: string;
  value: number;
  tone?: "default" | "emerald" | "amber" | "red";
}>) {
  const color = {
    default: "text-white",
    emerald: "text-emerald-300",
    amber: "text-amber-300",
    red: "text-red-300",
  }[tone];

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
      <p className={`text-2xl font-semibold ${color}`}>{value}</p>
      <p className="mt-1 text-xs text-slate-400">{label}</p>
    </div>
  );
}

function ErrorBanner({
  message,
  onRetry,
}: Readonly<{
  message: string;
  onRetry: () => void;
}>) {
  return (
    <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-red-300">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button
          onClick={onRetry}
          className="rounded-lg border border-red-500/30 px-3 py-2 text-sm text-red-200 transition-colors hover:bg-red-500/10"
        >
          Coba Lagi
        </button>
      </div>
    </div>
  );
}

type EditState = {
  title: string;
  subject: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  notes: string;
};

type EditSetters = {
  setTitle: (value: string) => void;
  setSubject: (value: string) => void;
  setStatus: (value: TaskStatus) => void;
  setPriority: (value: TaskPriority) => void;
  setDueDate: (value: string) => void;
  setNotes: (value: string) => void;
};

function TaskCard({
  task,
  todayKey,
  editing,
  processing,
  editState,
  setEditState,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onToggleStatus,
  onDelete,
}: Readonly<{
  task: Task;
  todayKey: string;
  editing: boolean;
  processing: boolean;
  editState: EditState;
  setEditState: EditSetters;
  onStartEdit: (task: Task) => void;
  onCancelEdit: () => void;
  onSubmitEdit: (event: FormEvent<HTMLFormElement>, taskId: string) => void;
  onToggleStatus: (task: Task) => void;
  onDelete: (taskId: string) => void;
}>) {
  const deadlineMeta = TaskDeadline.meta(task, todayKey);
  const checklist = TaskMetrics.subtaskProgress(task);

  return (
    <article className="rounded-lg border border-slate-800 bg-slate-900 p-4 transition-colors hover:border-slate-700">
      {editing ? (
        <form onSubmit={(e) => onSubmitEdit(e, task.id)} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Nama Task">
              <input
                type="text"
                value={editState.title}
                onChange={(e) => setEditState.setTitle(e.target.value)}
                className={inputClassName}
                required
              />
            </Field>
            <Field label="Mata Kuliah">
              <input
                type="text"
                value={editState.subject}
                onChange={(e) => setEditState.setSubject(e.target.value)}
                className={inputClassName}
                required
              />
            </Field>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <Field label="Status">
              <select
                value={editState.status}
                onChange={(e) => setEditState.setStatus(e.target.value as TaskStatus)}
                className={inputClassName}
              >
                <option value="Belum">Belum</option>
                <option value="Selesai">Selesai</option>
              </select>
            </Field>
            <Field label="Prioritas">
              <select
                value={editState.priority}
                onChange={(e) => setEditState.setPriority(e.target.value as TaskPriority)}
                className={inputClassName}
              >
                {priorityOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Deadline">
              <input
                type="date"
                value={editState.dueDate}
                onChange={(e) => setEditState.setDueDate(e.target.value)}
                className={inputClassName}
              />
            </Field>
          </div>

          <Field label="Catatan">
            <textarea
              value={editState.notes}
              onChange={(e) => setEditState.setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              className={`${inputClassName} resize-none`}
            />
          </Field>

          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancelEdit}
              className="flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
              Batal
            </button>
            <button
              type="submit"
              disabled={processing}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-900 disabled:text-slate-400"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan
            </button>
          </div>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${priorityStyles[task.priority]}`}
                >
                  <Flag className="h-3.5 w-3.5" />
                  {task.priority}
                </span>
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${deadlineMeta.className}`}
                >
                  <Calendar className="h-3.5 w-3.5" />
                  {deadlineMeta.label}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-xs font-medium text-slate-300">
                  <ClipboardCheck className="h-3.5 w-3.5" />
                  {checklist.completed}/{checklist.total} checklist
                </span>
              </div>
              <h3 className="text-base font-semibold text-white">{task.title}</h3>
              <p className="mt-1 flex items-center gap-1 text-sm text-slate-400">
                <BookOpen className="h-3.5 w-3.5" />
                {task.subject}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/tasks/${task.id}`}
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 text-sm text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <ExternalLink className="h-4 w-4" />
                Detail
              </Link>
              <button
                type="button"
                onClick={() => onToggleStatus(task)}
                disabled={processing}
                className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  task.status === "Selesai"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    : "border-blue-500/20 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
                }`}
              >
                {processing ? "Memproses..." : task.status === "Selesai" ? "Selesai" : "Belum Selesai"}
              </button>
              <button
                type="button"
                onClick={() => onStartEdit(task)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
                aria-label={`Edit ${task.title}`}
                title="Edit task"
              >
                <Pencil className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(task.id)}
                disabled={processing}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/30 text-red-300 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                aria-label={`Hapus ${task.title}`}
                title="Hapus task"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {task.notes ? (
            <p className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm leading-6 text-slate-300">
              {task.notes}
            </p>
          ) : null}
        </div>
      )}
    </article>
  );
}
