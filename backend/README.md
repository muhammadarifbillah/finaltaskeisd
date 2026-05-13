# StudyFlow Backend

Backend Node.js untuk aplikasi StudyFlow. API ini berjalan di port `5001` secara default dan sudah cocok dengan frontend yang memanggil `http://localhost:5001/tasks`.

## Menjalankan

```bash
cd backend
npm run dev
```

Untuk mode biasa:

```bash
npm start
```

## Environment

- `PORT`: port server, default `5001`
- `CORS_ORIGIN`: origin frontend yang diizinkan, default `http://localhost:3000`

## Endpoint

- `GET /health`: cek status server
- `GET /tasks`: ambil semua task
- `POST /tasks`: tambah task
- `GET /tasks/:id`: ambil satu task
- `PATCH /tasks/:id`: ubah task
- `DELETE /tasks/:id`: hapus task
- `POST /tasks/:id/subtasks`: tambah checklist subtask
- `PATCH /tasks/:id/subtasks/:subtaskId`: ubah checklist subtask
- `DELETE /tasks/:id/subtasks/:subtaskId`: hapus checklist subtask

Contoh body untuk `POST /tasks`:

```json
{
  "title": "Baca Jurnal",
  "subject": "Metodologi Penelitian",
  "status": "Belum",
  "priority": "Sedang",
  "dueDate": "2026-05-20",
  "notes": "Buat rangkuman setelah membaca.",
  "subtasks": []
}
```

Data disimpan di `data/tasks.json`.
