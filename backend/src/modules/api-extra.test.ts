import request from 'supertest';
import { createApp } from '../app.js';
import { pool } from '../lib/pg.js';
import {
  cleanupTestData,
  createAssignment,
  createClass,
  createPrompt,
  createSubmission,
  createUser,
  enroll,
} from '../test/fixtures.js';

const app = createApp();

let adminToken: string;
let guruToken: string;
let siswaToken: string;

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ identifier: email, password });
  return res.body.data.token as string;
}

describe('assignments endpoints', () => {
  let guruId: number;
  let classId: number;
  let promptId: number;
  let assignmentId: number;

  beforeAll(async () => {
    const guru = await createUser('guru');
    const siswa = await createUser('siswa');
    guruId = guru.id;
    guruToken = await login(guru.email, guru.password);
    adminToken = await login('admin@pessay.test', 'admin123');
    siswaToken = await login(siswa.email, siswa.password);
    classId = await createClass(`CLS-ASGE-${Date.now().toString().slice(-6)}`, guruId);
    await enroll(classId, siswa.id);
    promptId = await createPrompt({ subject: 'bahasa' });
    assignmentId = await createAssignment(promptId, classId, `Ujian-ASGE-${Date.now().toString().slice(-6)}`);
  }, 30000);

  afterAll(async () => {
    await cleanupTestData();
  });

  it('guru dapat list assignments (dengan count submission)', async () => {
    const res = await request(app).get('/api/v1/assignments').set('Authorization', `Bearer ${guruToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0]).toHaveProperty('submissionCount');
  });

  it('guru nonaktifkan ujian → 200, siswa tidak lagi melihatnya', async () => {
    const res = await request(app)
      .patch(`/api/v1/assignments/${assignmentId}`)
      .set('Authorization', `Bearer ${guruToken}`)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);

    const avail = await request(app).get('/api/v1/assignments/available').set('Authorization', `Bearer ${siswaToken}`);
    expect(avail.status).toBe(200);
    expect(avail.body.data.some((a: { id: number }) => a.id === assignmentId)).toBe(false);
  });

  it('patch ujian tidak ada → 404', async () => {
    const res = await request(app)
      .patch('/api/v1/assignments/999999')
      .set('Authorization', `Bearer ${guruToken}`)
      .send({ isActive: true });
    expect(res.status).toBe(404);
  });

  it('siswa tidak bisa list assignments → 403', async () => {
    const res = await request(app).get('/api/v1/assignments').set('Authorization', `Bearer ${siswaToken}`);
    expect(res.status).toBe(403);
  });

  it('post assignment tanpa auth → 401', async () => {
    const res = await request(app).post('/api/v1/assignments').send({ promptId, classId, title: 'x' });
    expect(res.status).toBe(401);
  });
});

describe('prompts endpoints', () => {
  let createdPrompt: number;

  beforeAll(async () => {
    const guru = await createUser('guru');
    guruToken = await login(guru.email, guru.password);
  }, 30000);

  afterAll(async () => {
    await cleanupTestData();
  });

  it('detail soal → 200 + data lengkap', async () => {
    const create = await request(app)
      .post('/api/v1/prompts')
      .set('Authorization', `Bearer ${guruToken}`)
      .send({
        title: 'Soal Detail',
        subject: 'matematika',
        language: 'id',
        instructions: 'Selesaikan dan tulis langkahnya.',
        rubric: [{ name: 'Langkah', max: 100, description: 'Proses' }],
        maxScore: 100,
      });
    createdPrompt = create.body.data.id as number;
    const res = await request(app).get(`/api/v1/prompts/${createdPrompt}`).set('Authorization', `Bearer ${guruToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.subject).toBe('matematika');
    expect(res.body.data.rubric).toHaveLength(1);
  });

  it('detail soal tidak ada → 404', async () => {
    const res = await request(app).get('/api/v1/prompts/999999').set('Authorization', `Bearer ${guruToken}`);
    expect(res.status).toBe(404);
  });

  it('hapus soal → 200, lalu 404', async () => {
    const del = await request(app).delete(`/api/v1/prompts/${createdPrompt}`).set('Authorization', `Bearer ${guruToken}`);
    expect(del.status).toBe(200);
    const again = await request(app).get(`/api/v1/prompts/${createdPrompt}`).set('Authorization', `Bearer ${guruToken}`);
    expect(again.status).toBe(404);
  });

  it('hapus soal tidak ada → 404', async () => {
    const res = await request(app).delete('/api/v1/prompts/999999').set('Authorization', `Bearer ${guruToken}`);
    expect(res.status).toBe(404);
  });
});

describe('admin class/users endpoints', () => {
  beforeAll(async () => {
    adminToken = await login('admin@pessay.test', 'admin123');
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('list classes → 200 dengan student_count', async () => {
    const res = await request(app).get('/api/v1/admin/classes').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('list users → 200', async () => {
    const res = await request(app).get('/api/v1/admin/users').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.some((u: { email: string }) => u.email === 'admin@pessay.test')).toBe(true);
  });

  it('patch user tidak ada → 404', async () => {
    const res = await request(app)
      .patch('/api/v1/admin/users/999999')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: true });
    expect(res.status).toBe(404);
  });

  it('enroll dengan studentIds kosong → 400', async () => {
    const cls = await createClass(`CLS-EMP-${Date.now().toString().slice(-6)}`);
    const res = await request(app)
      .post(`/api/v1/admin/classes/${cls}/enroll`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [] });
    expect(res.status).toBe(400);
  });

  it('buat user dengan email tidak valid → 400', async () => {
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'bukan-email', password: 'Password123!', fullName: 'X', role: 'siswa' });
    expect(res.status).toBe(400);
  });
});

// Pipeline: review needs_review / unscorable via API
describe('review flow via API', () => {
  it('guru review submission needs_review → graded dengan skor', async () => {
    const guru = await createUser('guru');
    const siswa = await createUser('siswa');
    const gToken = await login(guru.email, guru.password);
    const cls = await createClass(`CLS-RVF-${Date.now().toString().slice(-6)}`, guru.id);
    await enroll(cls, siswa.id);
    const prompt = await createPrompt({ subject: 'bahasa' });
    const asg = await createAssignment(prompt, cls, `Ujian-RVF-${Date.now().toString().slice(-6)}`);
    const sub = await createSubmission(asg, siswa.id, 'Perlu tinjauan manual guru.', 'needs_review');

    const res = await request(app)
      .put(`/api/v1/submissions/${sub}/review`)
      .set('Authorization', `Bearer ${gToken}`)
      .send({ status: 'graded', score: 90 });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('graded');
    expect(res.body.data.score).toBe(90);
  });

  it('review submission tidak ada → 404', async () => {
    const guru = await createUser('guru');
    const gToken = await login(guru.email, guru.password);
    const res = await request(app)
      .put('/api/v1/submissions/999999/review')
      .set('Authorization', `Bearer ${gToken}`)
      .send({ status: 'graded', score: 50 });
    expect(res.status).toBe(404);
  });
});