import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, "..", "data");
const TASKS_FILE = path.join(DATA_DIR, "tasks.json");

const PORT = Number(process.env.PORT || 5001);
const ALLOWED_ORIGIN = process.env.CORS_ORIGIN || "http://localhost:3000";
const VALID_STATUSES = new Set(["Belum", "Selesai"]);
const VALID_PRIORITIES = new Set(["Rendah", "Sedang", "Tinggi"]);

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

class ResponseWriter {
  static headers() {
    return {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
  }

  static json(response, statusCode, payload) {
    response.writeHead(statusCode, {
      ...ResponseWriter.headers(),
      "Content-Type": "application/json; charset=utf-8",
    });
    response.end(JSON.stringify(payload));
  }

  static empty(response, statusCode = 204) {
    response.writeHead(statusCode, ResponseWriter.headers());
    response.end();
  }
}

class RequestBody {
  static read(request) {
    return new Promise((resolve, reject) => {
      let body = "";

      request.on("data", (chunk) => {
        body += chunk;

        if (body.length > 1_000_000) {
          reject(new HttpError(413, "Request body terlalu besar"));
          request.destroy();
        }
      });

      request.on("end", () => {
        if (!body) {
          resolve({});
          return;
        }

        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new HttpError(400, "Body harus berupa JSON valid"));
        }
      });

      request.on("error", reject);
    });
  }
}

class DateValidator {
  static isValidDateInput(value) {
    if (!value) return true;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

    const parsedDate = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().startsWith(value);
  }
}

class TaskMapper {
  static normalizeStoredTask(task) {
    const source = task && typeof task === "object" ? task : {};
    const now = new Date().toISOString();

    return {
      id: typeof source.id === "string" && source.id ? source.id : randomUUID(),
      title: typeof source.title === "string" ? source.title : "",
      subject: typeof source.subject === "string" ? source.subject : "",
      status: VALID_STATUSES.has(source.status) ? source.status : "Belum",
      priority: VALID_PRIORITIES.has(source.priority) ? source.priority : "Sedang",
      dueDate:
        typeof source.dueDate === "string" && DateValidator.isValidDateInput(source.dueDate)
          ? source.dueDate
          : "",
      notes: typeof source.notes === "string" ? source.notes : "",
      subtasks: Array.isArray(source.subtasks)
        ? source.subtasks.map((subtask) => TaskMapper.normalizeStoredSubtask(subtask))
        : [],
      createdAt: typeof source.createdAt === "string" ? source.createdAt : now,
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : now,
    };
  }

  static normalizeStoredSubtask(subtask) {
    const source = subtask && typeof subtask === "object" ? subtask : {};
    const now = new Date().toISOString();

    return {
      id: typeof source.id === "string" && source.id ? source.id : randomUUID(),
      title: typeof source.title === "string" ? source.title : "",
      done: Boolean(source.done),
      createdAt: typeof source.createdAt === "string" ? source.createdAt : now,
      updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : now,
    };
  }

  static normalizeTaskInput(input, { partial = false } = {}) {
    const source = input && typeof input === "object" ? input : {};
    const next = {};

    if ("title" in source) next.title = String(source.title).trim();
    if ("subject" in source) next.subject = String(source.subject).trim();
    if ("status" in source) next.status = String(source.status).trim();
    if ("priority" in source) next.priority = String(source.priority).trim();
    if ("dueDate" in source) next.dueDate = String(source.dueDate).trim();
    if ("notes" in source) next.notes = String(source.notes).trim();

    if (!partial) {
      next.title = next.title || "";
      next.subject = next.subject || "";
      next.status = next.status || "Belum";
      next.priority = next.priority || "Sedang";
      next.dueDate = next.dueDate || "";
      next.notes = next.notes || "";
      next.subtasks = [];
    }

    TaskMapper.validateTaskInput(next);
    return next;
  }

  static normalizeSubtaskInput(input, { partial = false } = {}) {
    const source = input && typeof input === "object" ? input : {};
    const next = {};

    if ("title" in source) next.title = String(source.title).trim();
    if ("done" in source) next.done = Boolean(source.done);

    if (!partial) {
      next.title = next.title || "";
      next.done = false;
    }

    if ("title" in next && !next.title) {
      throw new HttpError(400, "Nama subtask wajib diisi");
    }

    if ("title" in next && next.title.length > 140) {
      throw new HttpError(400, "Nama subtask maksimal 140 karakter");
    }

    return next;
  }

  static validateTaskInput(task) {
    if ("title" in task && !task.title) {
      throw new HttpError(400, "Nama task wajib diisi");
    }

    if ("subject" in task && !task.subject) {
      throw new HttpError(400, "Mata kuliah wajib diisi");
    }

    if ("status" in task && !VALID_STATUSES.has(task.status)) {
      throw new HttpError(400, "Status harus bernilai 'Belum' atau 'Selesai'");
    }

    if ("priority" in task && !VALID_PRIORITIES.has(task.priority)) {
      throw new HttpError(400, "Prioritas harus bernilai 'Rendah', 'Sedang', atau 'Tinggi'");
    }

    if ("dueDate" in task && !DateValidator.isValidDateInput(task.dueDate)) {
      throw new HttpError(400, "Deadline harus memakai format YYYY-MM-DD");
    }

    if ("notes" in task && task.notes.length > 500) {
      throw new HttpError(400, "Catatan maksimal 500 karakter");
    }
  }
}

class TaskRepository {
  constructor(filePath) {
    this.filePath = filePath;
  }

  async ensureDataFile() {
    await mkdir(path.dirname(this.filePath), { recursive: true });

    try {
      await readFile(this.filePath, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      await this.writeAll([]);
    }
  }

  async readAll() {
    await this.ensureDataFile();
    const raw = await readFile(this.filePath, "utf8");

    try {
      const tasks = JSON.parse(raw);
      return Array.isArray(tasks) ? tasks.map((task) => TaskMapper.normalizeStoredTask(task)) : [];
    } catch {
      return [];
    }
  }

  async writeAll(tasks) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, `${JSON.stringify(tasks, null, 2)}\n`, "utf8");
  }
}

class TaskService {
  constructor(repository) {
    this.repository = repository;
  }

  async listTasks() {
    return this.repository.readAll();
  }

  async getTask(taskId) {
    const tasks = await this.repository.readAll();
    const task = tasks.find((item) => item.id === taskId);
    if (!task) throw new HttpError(404, "Task tidak ditemukan");
    return task;
  }

  async createTask(input) {
    const now = new Date().toISOString();
    const task = {
      id: randomUUID(),
      ...TaskMapper.normalizeTaskInput(input),
      createdAt: now,
      updatedAt: now,
    };
    const tasks = await this.repository.readAll();
    tasks.push(task);
    await this.repository.writeAll(tasks);
    return task;
  }

  async updateTask(taskId, input) {
    return this.updateTaskCollection(taskId, (task) => ({
      ...task,
      ...TaskMapper.normalizeTaskInput(input, { partial: true }),
      updatedAt: new Date().toISOString(),
    }));
  }

  async deleteTask(taskId) {
    const tasks = await this.repository.readAll();
    const nextTasks = tasks.filter((item) => item.id !== taskId);
    if (nextTasks.length === tasks.length) throw new HttpError(404, "Task tidak ditemukan");
    await this.repository.writeAll(nextTasks);
  }

  async addSubtask(taskId, input) {
    const now = new Date().toISOString();
    const subtask = {
      id: randomUUID(),
      ...TaskMapper.normalizeSubtaskInput(input),
      createdAt: now,
      updatedAt: now,
    };

    return this.updateTaskCollection(taskId, (task) => ({
      ...task,
      subtasks: [...task.subtasks, subtask],
      updatedAt: now,
    }));
  }

  async updateSubtask(taskId, subtaskId, input) {
    const now = new Date().toISOString();
    const nextSubtask = TaskMapper.normalizeSubtaskInput(input, { partial: true });

    return this.updateTaskCollection(taskId, (task) => {
      const subtaskExists = task.subtasks.some((subtask) => subtask.id === subtaskId);
      if (!subtaskExists) throw new HttpError(404, "Subtask tidak ditemukan");

      return {
        ...task,
        subtasks: task.subtasks.map((subtask) =>
          subtask.id === subtaskId ? { ...subtask, ...nextSubtask, updatedAt: now } : subtask,
        ),
        updatedAt: now,
      };
    });
  }

  async deleteSubtask(taskId, subtaskId) {
    return this.updateTaskCollection(taskId, (task) => {
      const nextSubtasks = task.subtasks.filter((subtask) => subtask.id !== subtaskId);
      if (nextSubtasks.length === task.subtasks.length) {
        throw new HttpError(404, "Subtask tidak ditemukan");
      }

      return {
        ...task,
        subtasks: nextSubtasks,
        updatedAt: new Date().toISOString(),
      };
    });
  }

  async updateTaskCollection(taskId, updater) {
    const tasks = await this.repository.readAll();
    const taskIndex = tasks.findIndex((item) => item.id === taskId);
    if (taskIndex === -1) throw new HttpError(404, "Task tidak ditemukan");

    const updatedTask = updater(tasks[taskIndex]);
    tasks[taskIndex] = updatedTask;
    await this.repository.writeAll(tasks);
    return updatedTask;
  }
}

class TaskRouteParser {
  static parse(pathname) {
    const taskMatch = pathname.match(/^\/tasks\/([^/]+)$/);
    if (taskMatch) return { taskId: decodeURIComponent(taskMatch[1]) };

    const subtaskCollectionMatch = pathname.match(/^\/tasks\/([^/]+)\/subtasks$/);
    if (subtaskCollectionMatch) {
      return { taskId: decodeURIComponent(subtaskCollectionMatch[1]), subtaskCollection: true };
    }

    const subtaskMatch = pathname.match(/^\/tasks\/([^/]+)\/subtasks\/([^/]+)$/);
    if (subtaskMatch) {
      return {
        taskId: decodeURIComponent(subtaskMatch[1]),
        subtaskId: decodeURIComponent(subtaskMatch[2]),
      };
    }

    return {};
  }
}

class ApiRouter {
  constructor(taskService) {
    this.taskService = taskService;
  }

  async handle(request, response) {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    const route = TaskRouteParser.parse(url.pathname);

    if (request.method === "OPTIONS") {
      ResponseWriter.empty(response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/health") {
      ResponseWriter.json(response, 200, { status: "ok" });
      return;
    }

    if (request.method === "GET" && url.pathname === "/tasks") {
      ResponseWriter.json(response, 200, await this.taskService.listTasks());
      return;
    }

    if (request.method === "POST" && url.pathname === "/tasks") {
      const task = await this.taskService.createTask(await RequestBody.read(request));
      ResponseWriter.json(response, 201, task);
      return;
    }

    if (request.method === "GET" && route.taskId && !route.subtaskId && !route.subtaskCollection) {
      ResponseWriter.json(response, 200, await this.taskService.getTask(route.taskId));
      return;
    }

    if (request.method === "PATCH" && route.taskId && !route.subtaskId && !route.subtaskCollection) {
      const task = await this.taskService.updateTask(route.taskId, await RequestBody.read(request));
      ResponseWriter.json(response, 200, task);
      return;
    }

    if (request.method === "DELETE" && route.taskId && !route.subtaskId && !route.subtaskCollection) {
      await this.taskService.deleteTask(route.taskId);
      ResponseWriter.empty(response);
      return;
    }

    if (request.method === "POST" && route.taskId && route.subtaskCollection) {
      const task = await this.taskService.addSubtask(route.taskId, await RequestBody.read(request));
      ResponseWriter.json(response, 201, task);
      return;
    }

    if (request.method === "PATCH" && route.taskId && route.subtaskId) {
      const task = await this.taskService.updateSubtask(
        route.taskId,
        route.subtaskId,
        await RequestBody.read(request),
      );
      ResponseWriter.json(response, 200, task);
      return;
    }

    if (request.method === "DELETE" && route.taskId && route.subtaskId) {
      const task = await this.taskService.deleteSubtask(route.taskId, route.subtaskId);
      ResponseWriter.json(response, 200, task);
      return;
    }

    throw new HttpError(404, "Endpoint tidak ditemukan");
  }
}

class StudyFlowServer {
  constructor(router, port) {
    this.router = router;
    this.port = port;
    this.server = createServer((request, response) => this.handle(request, response));
  }

  async handle(request, response) {
    try {
      await this.router.handle(request, response);
    } catch (error) {
      const statusCode = error instanceof HttpError ? error.statusCode : 500;
      const message =
        error instanceof Error ? error.message : "Terjadi kesalahan server";
      ResponseWriter.json(response, statusCode, { message });
    }
  }

  listen() {
    this.server.listen(this.port, () => {
      console.log(`StudyFlow backend berjalan di http://localhost:${this.port}`);
    });
  }
}

const repository = new TaskRepository(TASKS_FILE);
const taskService = new TaskService(repository);
const router = new ApiRouter(taskService);
const server = new StudyFlowServer(router, PORT);

server.listen();
