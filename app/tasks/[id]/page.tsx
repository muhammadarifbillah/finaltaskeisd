"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  CheckCircle,
  ClipboardCheck,
  Flag,
  Loader2,
  Pause,
  Play,
  PlusCircle,
  RotateCcw,
  Timer,
  Trash2,
} from "lucide-react";
import {
  PomodoroClock,
  priorityStyles,
  studyFlowApi,
  TaskDeadline,
  TaskMetrics,
  type PomodoroMode,
  type Subtask,
  type Task,
} from "../../lib/studyflow";

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const taskId = params.id;

  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [submittingSubtask, setSubmittingSubtask] = useState(false);
  const [processingSubtaskId, setProcessingSubtaskId] = useState<string | null>(null);
  const [processingTask, setProcessingTask] = useState(false);

  const [mode, setMode] = useState<PomodoroMode>("focus");
  const [seconds, setSeconds] = useState(PomodoroClock.focusSeconds);
  const [running, setRunning] = useState(false);

  const todayKey = useMemo(() => TaskDeadline.todayKey(), []);
  const checklist = useMemo(
    () => (task ? TaskMetrics.subtaskProgress(task) : { total: 0, completed: 0, progress: 0 }),
    [task],
  );

  useEffect(() => {
    let isMounted = true;

    studyFlowApi
      .getTask(taskId)
      .then((data) => {
        if (!isMounted) return;
        setTask(data);
        setError(null);
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err.message : "Gagal memuat task");
      })
      .finally(() => {
        if (!isMounted) return;
        setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [taskId]);

  useEffect(() => {
    if (!running) return;

    const intervalId = window.setInterval(() => {
      setSeconds((currentSeconds) => {
        if (currentSeconds > 1) return currentSeconds - 1;

        const nextMode = PomodoroClock.nextMode(mode);
        setMode(nextMode);
        setRunning(false);
        return PomodoroClock.durationFor(nextMode);
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [mode, running]);

  const refreshTask = async () => {
    try {
      setLoading(true);
      const data = await studyFlowApi.getTask(taskId);
      setTask(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat task");
    } finally {
      setLoading(false);
    }
  };

  const toggleTaskStatus = async () => {
    if (!task) return;

    try {
      setProcessingTask(true);
      const updatedTask = await studyFlowApi.updateTask(task.id, {
        status: task.status === "Selesai" ? "Belum" : "Selesai",
      });
      setTask(updatedTask);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah status task");
    } finally {
      setProcessingTask(false);
    }
  };

  const addSubtask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!task) return;

    const title = subtaskTitle.trim();
    if (!title) return;

    try {
      setSubmittingSubtask(true);
      const updatedTask = await studyFlowApi.addSubtask(task.id, title);
      setTask(updatedTask);
      setSubtaskTitle("");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menambahkan checklist");
    } finally {
      setSubmittingSubtask(false);
    }
  };

  const toggleSubtask = async (subtask: Subtask) => {
    if (!task) return;

    try {
      setProcessingSubtaskId(subtask.id);
      const updatedTask = await studyFlowApi.updateSubtask(task.id, subtask.id, {
        done: !subtask.done,
      });
      setTask(updatedTask);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengubah checklist");
    } finally {
      setProcessingSubtaskId(null);
    }
  };

  const deleteSubtask = async (subtaskId: string) => {
    if (!task) return;

    try {
      setProcessingSubtaskId(subtaskId);
      const updatedTask = await studyFlowApi.deleteSubtask(task.id, subtaskId);
      setTask(updatedTask);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal menghapus checklist");
    } finally {
      setProcessingSubtaskId(null);
    }
  };

  const switchTimerMode = (nextMode: PomodoroMode) => {
    setMode(nextMode);
    setSeconds(PomodoroClock.durationFor(nextMode));
    setRunning(false);
  };

  if (loading) {
    return (
      <TaskDetailShell>
        <div className="flex min-h-[420px] flex-col items-center justify-center text-slate-400">
          <Loader2 className="mb-4 h-8 w-8 animate-spin text-blue-400" />
          <p>Memuat detail task...</p>
        </div>
      </TaskDetailShell>
    );
  }

  if (!task) {
    return (
      <TaskDetailShell>
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-5 text-red-200">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5" />
            <p>{error || "Task tidak ditemukan"}</p>
          </div>
          <button
            type="button"
            onClick={refreshTask}
            className="mt-4 rounded-lg border border-red-500/30 px-3 py-2 text-sm hover:bg-red-500/10"
          >
            Coba Lagi
          </button>
        </div>
      </TaskDetailShell>
    );
  }

  const deadlineMeta = TaskDeadline.meta(task, todayKey);

  return (
    <TaskDetailShell>
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-2">
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
                </div>
                <h1 className="text-2xl font-semibold text-white">{task.title}</h1>
                <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">
                  <BookOpen className="h-4 w-4 text-blue-400" />
                  {task.subject}
                </p>
              </div>

              <button
                type="button"
                onClick={toggleTaskStatus}
                disabled={processingTask}
                className={`inline-flex items-center justify-center rounded-full border px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  task.status === "Selesai"
                    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20"
                    : "border-blue-500/20 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20"
                }`}
              >
                {processingTask ? "Memproses..." : task.status}
              </button>
            </div>

            {task.notes ? (
              <p className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-sm leading-6 text-slate-300">
                {task.notes}
              </p>
            ) : (
              <p className="rounded-lg border border-dashed border-slate-800 bg-slate-950 p-4 text-sm text-slate-500">
                Belum ada catatan untuk task ini.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <ClipboardCheck className="h-5 w-5 text-blue-400" />
                  Checklist Subtask
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {checklist.completed} dari {checklist.total} selesai
                </p>
              </div>
              <span className="rounded-lg bg-blue-500/10 px-3 py-1 text-sm font-semibold text-blue-300">
                {checklist.progress}%
              </span>
            </div>

            <div className="mb-5 h-2 overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-blue-500 transition-all"
                style={{ width: `${checklist.progress}%` }}
              />
            </div>

            <form onSubmit={addSubtask} className="mb-4 flex flex-col gap-2 sm:flex-row">
              <input
                type="text"
                value={subtaskTitle}
                onChange={(event) => setSubtaskTitle(event.target.value)}
                placeholder="Tambah checklist, contoh: Buat rangkuman"
                className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-4 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500"
              />
              <button
                type="submit"
                disabled={submittingSubtask}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-900 disabled:text-slate-400"
              >
                {submittingSubtask ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PlusCircle className="h-4 w-4" />
                )}
                Tambah
              </button>
            </form>

            {task.subtasks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-slate-800 bg-slate-950 p-6 text-center text-sm text-slate-400">
                Belum ada checklist.
              </div>
            ) : (
              <div className="space-y-2">
                {task.subtasks.map((subtask) => (
                  <div
                    key={subtask.id}
                    className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950 p-3"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSubtask(subtask)}
                      disabled={processingSubtaskId === subtask.id}
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors ${
                        subtask.done
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                          : "border-slate-700 text-slate-400 hover:bg-slate-800"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                      aria-label={`Toggle ${subtask.title}`}
                    >
                      {processingSubtaskId === subtask.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </button>
                    <p
                      className={`min-w-0 flex-1 text-sm ${
                        subtask.done ? "text-slate-500 line-through" : "text-slate-200"
                      }`}
                    >
                      {subtask.title}
                    </p>
                    <button
                      type="button"
                      onClick={() => deleteSubtask(subtask.id)}
                      disabled={processingSubtaskId === subtask.id}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-red-500/30 text-red-300 transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={`Hapus ${subtask.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
              <Timer className="h-5 w-5 text-amber-300" />
              Pomodoro
            </h2>

            <div className="rounded-lg border border-slate-800 bg-slate-950 p-5 text-center">
              <p className="text-sm uppercase tracking-wide text-slate-500">
                {mode === "focus" ? "Fokus 25 menit" : "Istirahat 5 menit"}
              </p>
              <p className="mt-3 text-5xl font-semibold tabular-nums text-white">
                {PomodoroClock.format(seconds)}
              </p>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => switchTimerMode("focus")}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    mode === "focus"
                      ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                      : "border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Fokus
                </button>
                <button
                  type="button"
                  onClick={() => switchTimerMode("break")}
                  className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                    mode === "break"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                      : "border-slate-700 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  Istirahat
                </button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRunning((current) => !current)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                  {running ? "Pause" : "Mulai"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRunning(false);
                    setSeconds(PomodoroClock.durationFor(mode));
                  }}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-800"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-800 bg-slate-900 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-white">
              <CheckCircle className="h-5 w-5 text-emerald-300" />
              Ringkasan
            </h2>
            <div className="space-y-3 text-sm">
              <SummaryRow label="Status" value={task.status} />
              <SummaryRow label="Prioritas" value={task.priority} />
              <SummaryRow label="Deadline" value={TaskDeadline.format(task.dueDate)} />
              <SummaryRow label="Checklist" value={`${checklist.completed}/${checklist.total}`} />
            </div>
          </div>
        </aside>
      </div>
    </TaskDetailShell>
  );
}

function TaskDetailShell({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <nav className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-900 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Kembali
          </Link>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <BookOpen className="h-4 w-4 text-blue-400" />
            StudyFlow
          </div>
        </div>
      </nav>
      <main className="mx-auto w-full max-w-6xl px-5 py-6">{children}</main>
    </div>
  );
}

function SummaryRow({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  );
}
