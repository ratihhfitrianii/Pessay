# Pessay — Penilaian Esai Otomatis

Sistem Penilaian Esai Otomatis (AES) multi-bahasa (Indonesia, Inggris, Arab, Korea, Jepang, dll.)
dan matematika (uraian + LaTeX), dirancang untuk ujian serentak hingga **2.000 siswa**.

## Arsitektur (gratis & mudah maintenance)

| Komponen | Teknologi |
|---|---|
| Frontend | React + Vite + Tailwind → **Vercel** (gratis) |
| Backend API | Express + TypeScript → **Render** (gratis) |
| Database | PostgreSQL → **Neon** (gratis) |
| Cache/sesi | Redis → **Upstash** (gratis, opsional) |
| AI grading | Google Gemini Flash (BYOK, batch gratis) |

### Alur ujian serentak 2.000 siswa

1. **Kirim** (T+0s): 2.000 siswa submit esai → API terima instan (202 Accepted), simpan ke DB, masuk antrean.
2. **Antre** (T+0.2s): tidak ada proses AI sinkron — siswa langsung lihat "Terkirim, sedang diproses".
3. **Proses** (T+1s..T+N): worker batch (setInterval di backend) menggiling antrean dengan Gemini Flash.
   - Mode **mock** (tanpa API key) untuk demo/tes.
   - Mode **real** (API key Google AI Studio) untuk produksi — biaya ≈ $0 (kuota gratis 1.500 req/hari, batch beberapa menit untuk 2.000 esai).
4. **Hasil** (T+N): skor + feedback masuk DB; UI siswa refresh otomatis (polling), guru lihat dasbor.

### Perbedaan dari dokumen spesifikasi

Dokumen PRD/solusi menyarankan **Kafka + Kubernetes + AWS** — mahal dan berat maintenance.
Karena permintaan "gratis & mudah maintenance", diganti:

- Kafka/RabbitMQ → **antrean DB (PostgreSQL `FOR UPDATE SKIP LOCKED`)** — cukup untuk 10k esai/menit, tanpa broker ekstra.
- Kubernetes auto-scaling → **satu worker setInterval + paralelisme terkontrol** di backend Render.
- Redis → **opsional**, graceful-degradation (app tetap jalan tanpa Redis).
- Modal NLP (spaCy/XGBoost) → **Gemini Flash** (jauh lebih akurat lintas bahasa, zero-training).

## Struktur

```
Pessay/
├── backend/    Express + TS + Postgres + Jest
├── frontend/   React + Vite + Tailwind + Vitest
├── docs/       runbook deploy + arsitektur
└── *.docx      dokumen spesifikasi awal
```

## Menjalankan lokal

Lihat `docs/deploy-paas-free.md` untuk deploy; ringkas:

```bash
cd backend && npm install && cp .env.example .env && npm run migrate:up && npm run dev
cd frontend && npm install && npm run dev
```

Akun seed: `admin@pessay.test` / `admin123` (admin), `guru@pessay.test` / `guru123` (guru), `siswa@pessay.test` / `siswa123` (siswa).