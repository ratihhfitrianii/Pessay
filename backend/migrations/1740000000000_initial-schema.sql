-- Pessay initial schema: roles, users, classes, prompts, assignments,
-- submissions, scores, anomalies, feedback.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Roles ------------------------------------------------
CREATE TABLE roles (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(20) NOT NULL UNIQUE,
  name        VARCHAR(50) NOT NULL
);

-- Users ------------------------------------------------
CREATE TABLE users (
  id           SERIAL PRIMARY KEY,
  email        VARCHAR(255) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  full_name    VARCHAR(120) NOT NULL,
  role_id      INT NOT NULL REFERENCES roles(id),
  school_id    INT,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_role ON users(role_id);

-- Classes (ruang kelas virtual) -------------------------
CREATE TABLE classes (
  id         SERIAL PRIMARY KEY,
  code       VARCHAR(32) NOT NULL UNIQUE,
  name       VARCHAR(120) NOT NULL,
  teacher_id INT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enrollments (siswa -> kelas) --------------------------
CREATE TABLE enrollments (
  id         SERIAL PRIMARY KEY,
  class_id   INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);

-- Prompts (bank soal) -----------------------------------
CREATE TABLE prompts (
  id               SERIAL PRIMARY KEY,
  title            VARCHAR(200) NOT NULL,
  subject          VARCHAR(30) NOT NULL, -- 'bahasa' | 'matematika'
  language         VARCHAR(30) NOT NULL DEFAULT 'id', -- ISO 639-1 / 'latex'
  instructions     TEXT NOT NULL,
  rubric_json      TEXT NOT NULL DEFAULT '[]',
  max_score        INT NOT NULL DEFAULT 100,
  teacher_id       INT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assignments (penugasan/ujian) -------------------------
CREATE TABLE assignments (
  id          SERIAL PRIMARY KEY,
  prompt_id   INT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  class_id    INT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
  title       VARCHAR(200) NOT NULL,
  due_at      TIMESTAMPTZ,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Submissions (kiriman siswa) ---------------------------
CREATE TABLE submissions (
  id             SERIAL PRIMARY KEY,
  assignment_id  INT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id     INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body           TEXT NOT NULL,
  status         VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending|processing|graded|needs_review|unscorable
  score          NUMERIC(6,2),
  feedback_json  TEXT,
  anomaly_json   TEXT NOT NULL DEFAULT '[]',
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  graded_at      TIMESTAMPTZ,
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX idx_submissions_status ON submissions(status, id);
CREATE INDEX idx_submissions_assignment ON submissions(assignment_id);

-- Scores per rubrik dimensi ----------------------------
CREATE TABLE scores (
  id            SERIAL PRIMARY KEY,
  submission_id INT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  dimension     VARCHAR(50) NOT NULL,
  score         NUMERIC(6,2) NOT NULL,
  max_score     NUMERIC(6,2) NOT NULL,
  comment       TEXT
);

-- Anomalies (integritas) -------------------------------
CREATE TABLE anomalies (
  id            SERIAL PRIMARY KEY,
  submission_id INT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  type          VARCHAR(40) NOT NULL, -- plagiarism|repetition|ai_generated|unscorable
  confidence    NUMERIC(5,2) NOT NULL DEFAULT 0,
  detail        TEXT
);

-- Seed: roles + demo accounts --------------------------
INSERT INTO roles (code, name) VALUES
  ('admin',   'Administrator'),
  ('guru',    'Guru'),
  ('siswa',   'Siswa');

INSERT INTO users (email, password_hash, full_name, role_id, is_active) VALUES
  ('admin@pessay.test', '$2a$12$.bAaKeBvO3JgI22jc2P4F.afo3LtpjcEj5A/iy4IS8bPa.gjLj1ju', 'Admin Pessay', (SELECT id FROM roles WHERE code='admin'), TRUE),
  ('guru@pessay.test',  '$2a$12$0QyN2uBDCds.yOQodARWN.I9KSa0eS4kt3TsSJXvQlQxwgPQ0HLD2', 'Guru Bahasa',   (SELECT id FROM roles WHERE code='guru'),  TRUE),
  ('siswa@pessay.test', '$2a$12$0bPoQbpeIuHXrh15ckm8LugSFu0Y0kSD0IgGjnxJEf1jOZnmR4/j2', 'Siswa Contoh',  (SELECT id FROM roles WHERE code='siswa'), TRUE);