import request from "supertest";
import { createApp } from "../../app";
import {
  cleanupTestData,
  createAssignment,
  createClass,
  createPrompt,
  createSubmission,
  createUser,
  enroll,
  uniqueEmail,
} from "../../test/fixtures";

const app = createApp();

let guruToken: string;
let siswaToken: string;
let guruId: number;
let siswaId: number;
let classId: number;
let promptId: number;
let assignmentId: number;

async function login(email: string, password: string): Promise<string> {
  const res = await request(app)
    .post("/api/v1/auth/login")
    .send({ identifier: email, password });
  return res.body.data.token as string;
}

describe("submissions flow", () => {
  beforeAll(async () => {
    const guru = await createUser("guru");
    const siswa = await createUser("siswa");
    guruId = guru.id;
    siswaId = siswa.id;
    guruToken = await login(guru.email, guru.password);
    siswaToken = await login(siswa.email, siswa.password);

    classId = await createClass(
      `CLS-SUB-${Date.now().toString().slice(-6)}`,
      guruId,
    );
    await enroll(classId, siswaId);
    promptId = await createPrompt({ subject: "bahasa" });
    assignmentId = await createAssignment(
      promptId,
      classId,
      `Ujian-SUB-${Date.now().toString().slice(-6)}`,
    );
  }, 30000);

  afterAll(async () => {
    await cleanupTestData();
  });

  it("siswa submit → 202 accepted, status pending", async () => {
    const res = await request(app)
      .post("/api/v1/submissions/submit")
      .set("Authorization", `Bearer ${siswaToken}`)
      .send({
        assignmentId,
        body: "Ini adalah jawaban esai saya tentang pentingnya pendidikan bagi generasi muda Indonesia yang cerdas dan berkarakter.",
      });
    expect(res.status).toBe(202);
    expect(res.body.data.status).toBe("pending");
    expect(res.body.data.id).toBeDefined();
  });

  it("siswa belum submit → 404 saat polling hasil", async () => {
    const noSubmitPrompt = await createPrompt({ subject: "bahasa" });
    const noSubmitAssignment = await createAssignment(
      noSubmitPrompt,
      classId,
      `Ujian-NS-${Date.now().toString().slice(-6)}`,
    );
    const res = await request(app)
      .get(`/api/v1/submissions/my/${noSubmitAssignment}`)
      .set("Authorization", `Bearer ${siswaToken}`);
    expect(res.status).toBe(404);
  });

  it("siswa tidak terdaftar di kelas → 403", async () => {
    const stranger = await createUser("siswa");
    const token = await login(stranger.email, stranger.password);
    const res = await request(app)
      .post("/api/v1/submissions/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({ assignmentId, body: "Saya tidak terdaftar." });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("guru lihat daftar submission per assignment", async () => {
    const res = await request(app)
      .get(`/api/v1/submissions/assignment/${assignmentId}`)
      .set("Authorization", `Bearer ${guruToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBe(1);
    expect(res.body.data[0]).toHaveProperty("studentName");
  });

  it("siswa tidak bisa melihat kiriman semua user (403 untuk route guru)", async () => {
    const res = await request(app)
      .get(`/api/v1/submissions/assignment/${assignmentId}`)
      .set("Authorization", `Bearer ${siswaToken}`);
    expect(res.status).toBe(403);
  });
});

describe("review manual oleh guru", () => {
  let reviewClass: number;
  let reviewPrompt: number;
  let reviewAssignment: number;
  let reviewSubmission: number;

  beforeAll(async () => {
    const guru = await createUser("guru");
    const siswa = await createUser("siswa");
    guruToken = await login(guru.email, guru.password);
    siswaToken = await login(siswa.email, siswa.password);
    reviewClass = await createClass(
      `CLS-RV-${Date.now().toString().slice(-6)}`,
      guru.id,
    );
    await enroll(reviewClass, siswa.id);
    reviewPrompt = await createPrompt({ subject: "bahasa" });
    reviewAssignment = await createAssignment(
      reviewPrompt,
      reviewClass,
      `Ujian-RV-${Date.now().toString().slice(-6)}`,
    );
    reviewSubmission = await createSubmission(
      reviewAssignment,
      siswa.id,
      "Teks jawaban perlu ditinjau manual oleh guru.",
      "needs_review",
    );
  }, 30000);

  afterAll(async () => {
    await cleanupTestData();
  });

  it("guru setujui skor manual → status graded", async () => {
    const res = await request(app)
      .put(`/api/v1/submissions/${reviewSubmission}/review`)
      .set("Authorization", `Bearer ${guruToken}`)
      .send({ status: "graded", score: 85 });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("graded");
    expect(res.body.data.score).toBe(85);
  });
});

describe("rate limit submit", () => {
  it("submit kedua dalam 10 detik → 429", async () => {
    const guru = await createUser("guru");
    const siswa = await createUser("siswa");
    const token = await login(siswa.email, siswa.password);
    const cls = await createClass(
      `CLS-RL-${Date.now().toString().slice(-6)}`,
      guru.id,
    );
    await enroll(cls, siswa.id);
    const prompt = await createPrompt({ subject: "bahasa" });
    const asg = await createAssignment(
      prompt,
      cls,
      `Ujian-RL-${Date.now().toString().slice(-6)}`,
    );

    const first = await request(app)
      .post("/api/v1/submissions/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({
        assignmentId: asg,
        body: "Jawaban pertama untuk menguji batas frekuensi pengiriman oleh siswa bersangkutan.",
      });
    expect(first.status).toBe(202);

    const second = await request(app)
      .post("/api/v1/submissions/submit")
      .set("Authorization", `Bearer ${token}`)
      .send({
        assignmentId: asg,
        body: "Jawaban kedua yang seharusnya ditolak oleh sistem pengendali frekuensi pengiriman yang ketat.",
      });
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe("RATE_LIMITED");
  });
});

it("hanya siswa yang bisa submit → guru ditolak 403", async () => {
  const res = await request(app)
    .post("/api/v1/submissions/submit")
    .set("Authorization", `Bearer ${guruToken}`)
    .send({ assignmentId: 1, body: "Percobaan dari guru." });
  expect(res.status).toBe(403);
});

it("validasi: body kosong → 400", async () => {
  const res = await request(app)
    .post("/api/v1/submissions/submit")
    .set("Authorization", `Bearer ${siswaToken}`)
    .send({ assignmentId, body: "" });
  expect(res.status).toBe(400);
});

it("validasi: body terlalu panjang → 400", async () => {
  const res = await request(app)
    .post("/api/v1/submissions/submit")
    .set("Authorization", `Bearer ${siswaToken}`)
    .send({ assignmentId, body: "x".repeat(20001) });
  expect(res.status).toBe(400);
});

it("unauthorized tanpa token → 401", async () => {
  const res = await request(app)
    .post("/api/v1/submissions/submit")
    .send({ assignmentId, body: "tanpa token" });
  expect(res.status).toBe(401);
});

it("assignment tidak ditemukan → 404", async () => {
  const res = await request(app)
    .post("/api/v1/submissions/submit")
    .set("Authorization", `Bearer ${siswaToken}`)
    .send({ assignmentId: 999999, body: "Tidak ada ujian ini." });
  expect(res.status).toBe(404);
});

it("validasi: assignmentId bukan angka → 400", async () => {
  const res = await request(app)
    .post("/api/v1/submissions/submit")
    .set("Authorization", `Bearer ${siswaToken}`)
    .send({ assignmentId: "abc", body: "abc" });
  expect(res.status).toBe(400);
  void uniqueEmail;
});
