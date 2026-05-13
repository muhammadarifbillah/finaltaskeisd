export type TaskStatus = "Belum" | "Selesai";
export type TaskPriority = "Rendah" | "Sedang" | "Tinggi";
export type FilterStatus = "Semua" | "Belum" | "Selesai" | "Terlambat";
export type SortMode = "deadline" | "priority" | "newest" | "subject";
export type PomodoroMode = "focus" | "break";

export type Subtask = {
  id: string;
  title: string;
  done: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type Task = {
  id: string;
  title: string;
  subject: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  notes: string;
  subtasks: Subtask[];
  createdAt?: string;
  updatedAt?: string;
};

export type TaskInput = {
  title: string;
  subject: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  notes: string;
};

export type DashboardStats = {
  total: number;
  completed: number;
  overdue: number;
  dueToday: number;
  subjects: number;
  progress: number;
};

export const filterOptions: FilterStatus[] = ["Semua", "Belum", "Selesai", "Terlambat"];
export const priorityOptions: TaskPriority[] = ["Rendah", "Sedang", "Tinggi"];

const priorityRank: Record<TaskPriority, number> = {
  Rendah: 1,
  Sedang: 2,
  Tinggi: 3,
};

export const priorityStyles: Record<TaskPriority, string> = {
  Rendah: "border-slate-600 bg-slate-800/70 text-slate-300",
  Sedang: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  Tinggi: "border-rose-500/30 bg-rose-500/10 text-rose-300",
};

export class StudyFlowApi {
  constructor(private readonly baseUrl: string) {}

  async listTasks() {
    return this.request<Task[]>("/tasks");
  }

  async getTask(taskId: string) {
    return this.request<Task>(`/tasks/${taskId}`);
  }

  async createTask(input: TaskInput) {
    return this.request<Task>("/tasks", {
      method: "POST",
      body: JSON.stringify(input),
    });
  }

  async updateTask(taskId: string, input: Partial<TaskInput>) {
    return this.request<Task>(`/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async deleteTask(taskId: string) {
    return this.request<void>(`/tasks/${taskId}`, {
      method: "DELETE",
    });
  }

  async addSubtask(taskId: string, title: string) {
    return this.request<Task>(`/tasks/${taskId}/subtasks`, {
      method: "POST",
      body: JSON.stringify({ title }),
    });
  }

  async updateSubtask(taskId: string, subtaskId: string, input: Partial<Subtask>) {
    return this.request<Task>(`/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  }

  async deleteSubtask(taskId: string, subtaskId: string) {
    return this.request<Task>(`/tasks/${taskId}/subtasks/${subtaskId}`, {
      method: "DELETE",
    });
  }

  private async request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (response.status === 204) {
      return undefined as T;
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data?.message || "Request gagal diproses");
    }

    return data;
  }
}

export class TaskInputFactory {
  static create(
    title: string,
    subject: string,
    priority: TaskPriority,
    dueDate: string,
    notes: string,
    status: TaskStatus = "Belum",
  ): TaskInput {
    return {
      title: title.trim(),
      subject: subject.trim(),
      status,
      priority,
      dueDate,
      notes: notes.trim(),
    };
  }
}

export class TaskDeadline {
  static todayKey() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  static format(dateKey: string) {
    if (!dateKey) return "Tanpa deadline";

    return new Intl.DateTimeFormat("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(`${dateKey}T00:00:00`));
  }

  static isOverdue(task: Task, todayKey: string) {
    return task.status !== "Selesai" && Boolean(task.dueDate) && task.dueDate < todayKey;
  }

  static isDueToday(task: Task, todayKey: string) {
    return task.status !== "Selesai" && task.dueDate === todayKey;
  }

  static meta(task: Task, todayKey: string) {
    if (!task.dueDate) {
      return {
        label: "Tanpa deadline",
        className: "border-slate-700 bg-slate-800/70 text-slate-400",
      };
    }

    if (task.status === "Selesai") {
      return {
        label: TaskDeadline.format(task.dueDate),
        className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
      };
    }

    if (task.dueDate < todayKey) {
      return {
        label: `Terlambat: ${TaskDeadline.format(task.dueDate)}`,
        className: "border-red-500/30 bg-red-500/10 text-red-300",
      };
    }

    if (task.dueDate === todayKey) {
      return {
        label: "Deadline hari ini",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-300",
      };
    }

    return {
      label: TaskDeadline.format(task.dueDate),
      className: "border-blue-500/20 bg-blue-500/10 text-blue-300",
    };
  }
}

export class TaskMetrics {
  static dashboard(tasks: Task[], todayKey: string): DashboardStats {
    const total = tasks.length;
    const completed = tasks.filter((task) => task.status === "Selesai").length;
    const overdue = tasks.filter((task) => TaskDeadline.isOverdue(task, todayKey)).length;
    const dueToday = tasks.filter((task) => TaskDeadline.isDueToday(task, todayKey)).length;
    const subjects = new Set(tasks.map((task) => task.subject).filter(Boolean)).size;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

    return { total, completed, overdue, dueToday, subjects, progress };
  }

  static subtaskProgress(task: Task) {
    const total = task.subtasks.length;
    const completed = task.subtasks.filter((subtask) => subtask.done).length;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);

    return { total, completed, progress };
  }
}

export class TaskCollection {
  static filterAndSort(
    tasks: Task[],
    searchTerm: string,
    filterStatus: FilterStatus,
    sortMode: SortMode,
    todayKey: string,
  ) {
    const normalizedSearch = searchTerm.trim().toLowerCase();

    return [...tasks]
      .filter((task) => {
        const matchesSearch =
          !normalizedSearch ||
          task.title.toLowerCase().includes(normalizedSearch) ||
          task.subject.toLowerCase().includes(normalizedSearch) ||
          task.notes.toLowerCase().includes(normalizedSearch);

        if (!matchesSearch) return false;
        if (filterStatus === "Semua") return true;
        if (filterStatus === "Terlambat") return TaskDeadline.isOverdue(task, todayKey);
        return task.status === filterStatus;
      })
      .sort((a, b) => TaskCollection.compare(a, b, sortMode));
  }

  static reminders(tasks: Task[], todayKey: string) {
    return [...tasks]
      .filter(
        (task) =>
          TaskDeadline.isOverdue(task, todayKey) || TaskDeadline.isDueToday(task, todayKey),
      )
      .sort((a, b) => (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31"));
  }

  private static compare(a: Task, b: Task, sortMode: SortMode) {
    if (sortMode === "priority") {
      return (
        priorityRank[b.priority] - priorityRank[a.priority] ||
        (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31")
      );
    }

    if (sortMode === "newest") {
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    }

    if (sortMode === "subject") {
      return (
        a.subject.localeCompare(b.subject) ||
        (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31")
      );
    }

    return (
      (a.dueDate || "9999-12-31").localeCompare(b.dueDate || "9999-12-31") ||
      priorityRank[b.priority] - priorityRank[a.priority]
    );
  }
}

export class PomodoroClock {
  static readonly focusSeconds = 25 * 60;
  static readonly breakSeconds = 5 * 60;

  static durationFor(mode: PomodoroMode) {
    return mode === "focus" ? PomodoroClock.focusSeconds : PomodoroClock.breakSeconds;
  }

  static format(seconds: number) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${String(minutes).padStart(2, "0")}:${String(remainingSeconds).padStart(2, "0")}`;
  }

  static nextMode(mode: PomodoroMode): PomodoroMode {
    return mode === "focus" ? "break" : "focus";
  }
}

export const studyFlowApi = new StudyFlowApi(
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001",
);
