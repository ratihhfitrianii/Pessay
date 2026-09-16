import request from 'supertest';
import { createApp } from '../../app';
import { cleanupTestData, createClass, createPrompt, createUser, enroll, uniqueEmail } from '../../test/fixtures';

const app = createApp();

let adminToken: string;
let guruToken: string;
let siswaToken: string;

async function login(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/v1/auth/login').send({ identifier: email, password });
  return res.body.data.token as string;
}

describe('prompts', () => {
  beforeAll(async () => {
    const guru = await createUser('guru');
    guruToken = await login(guru.email, guru.password);
    adminToken = await login('admin@pessay.test', 'admin123');
    const siswa = await createUser('siswa');
    siswaToken = await login(siswa.email, siswa.password);
  }, 30000);

  afterAll(async () => {
    await cleanupTestData();
  });

  it('guru buat soal bahasa → 201', async () => {
    const res = await request(app)
      .post('/api/v1/prompts')
      .set('Authorization', `Bearer ${guruToken}`)
      .send({
        title: 'Esai Pentingnya Pendidikan',
        subject: 'bahasa',
        language: 'id',
        instructions: 'Tulis esai tentang pentingnya pendidikan.',
        rubric: [
          { name: 'Isi', max: 40, description: 'Kedalaman ide' },
          { name: 'Organisasi', max: 30, description: 'Struktur tulisan' },
          { name: 'Bahasa', max: 30, description: 'Penggunaan tata bahasa' },
        ],
        maxScore: 100,
      });
    expect(res.status).toBe(201);
  });

  it('guru buat soal matematika dengan bahasa latex → 201', async () => {
    const res = await request(app)
      .post('/api/v1/prompts')
      .set('Authorization', `Bearer ${guruToken}`)
      .send({
        title: 'Persamaan Linear',
        subject: 'matematika',
        language: 'id',
        instructions: 'Selesaikan: \\(2x + 4 = 16\\). Tulis langkah pengerjaan.',
        rubric: [{ name: 'Langkah', max: 50, description: 'Proses' }, { name: 'Jawaban Akhir', max: 50, description: 'Hasil' }],
        maxScore: 100,
      });
    expect(res.status).toBe(201);
  });

  it('siswa tidak boleh membuat soal → 403', async () => {
    const res = await request(app)
      .post('/api/v1/prompts')
      .set('Authorization', `Bearer ${siswaToken}`)
      .send({ title: 'x', subject: 'bahasa', language: 'id', instructions: 'abcde' });
    expect(res.status).toBe(403);
  });

  it('validasi: subject tidak valid → 400', async () => {
    const res = await request(app)
      .post('/api/v1/prompts')
      .set('Authorization', `Bearer ${guruToken}`)
      .send({ title: 'x', subject: 'sejarah', language: 'id', instructions: 'abcde' });
    expect(res.status).toBe(400);
  });

  it('listing soal dengan filter subject', async () => {
    const res = await request(app).get('/api/v1/prompts?subject=bahasa').set('Authorization', `Bearer ${guruToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].subject).toBe('bahasa');
  });
});

describe('assignments', () => {
  it('guru buat ujian untuk kelas → 201, siswa melihatnya di available', async () => {
    const guru = await createUser('guru');
    const siswa = await createUser('siswa');
    const gToken = await login(guru.email, guru.password);
    const sToken = await login(siswa.email, siswa.password);
    const classId = await createClass(`CLS-ASG-${Date.now().toString().slice(-6)}`, guru.id);
    await enroll(classId, siswa.id);
    const promptId = await createPrompt({ subject: 'bahasa' });

    const create = await request(app)
      .post('/api/v1/assignments')
      .set('Authorization', `Bearer ${gToken}`)
      .send({ promptId, classId, title: `Ujian-ASG-${Date.now().toString().slice(-6)}` });
    expect(create.status).toBe(201);
    const assignmentId = create.body.data.id as number;

    const avail = await request(app).get('/api/v1/assignments/available').set('Authorization', `Bearer ${sToken}`);
    expect(avail.status).toBe(200);
    expect(avail.body.data.some((a: { id: number }) => a.id === assignmentId)).toBe(true);
  });

  it('siswa tidak bisa membuat ujian → 403', async () => {
    const res = await request(app)
      .post('/api/v1/assignments')
      .set('Authorization', `Bearer ${siswaToken}`)
      .send({ promptId: 1, classId: 1, title: 'x' });
    expect(res.status).toBe(403);
  });

  it('admin bisa list assignments', async () => {
    const res = await request(app).get('/api/v1/assignments').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });
});

describe('admin', () => {
  it('statistik admin → angka lengkap', async () => {
    const res = await request(app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('users');
    expect(res.body.data).toHaveProperty('pending');
    expect(res.body.data).toHaveProperty('avgScore');
  });

  it('guru tidak bisa akses stats admin → 403', async () => {
    const res = await request(app).get('/api/v1/admin/stats').set('Authorization', `Bearer ${guruToken}`);
    expect(res.status).toBe(403);
  });

  it('admin buat user siswa → 201', async () => {
    const email = uniqueEmail('siswa');
    const res = await request(app)
      .post('/api/v1/admin/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email, password: 'Password123!', fullName: 'Siswa Baru', role: 'siswa' });
    expect(res.status).toBe(201);
  });

  it('admin buat kelas + enroll siswa', async () => {
    const create = await request(app)
      .post('/api/v1/admin/classes')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ code: `CLS-ADM-${Date.now().toString().slice(-6)}`, name: 'Kelas Admin' });
    expect(create.status).toBe(201);
    const classId = create.body.data.id as number;

    const siswa = await createUser('siswa');
    const enrollRes = await request(app)
      .post(`/api/v1/admin/classes/${classId}/enroll`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ studentIds: [siswa.id] });
    expect(enrollRes.status).toBe(200);
    expect(enrollRes.body.data.created).toBe(1);
  });

  it('admin nonaktifkan user', async () => {
    const siswa = await createUser('siswa');
    const res = await request(app)
      .patch(`/api/v1/admin/users/${siswa.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.data.isActive).toBe(false);
  });

  it('unauthorized tanpa token → 401', async () => {
    const res = await request(app).get('/api/v1/admin/stats');
    expect(res.status).toBe(401);
  });
});

describe('health', () => {
  it('health ok', async () => {
    const res = await request(app).get('/api/v1/health');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ok');
  });

  it('rute tak dikenal → 404', async () => {
    const res = await request(app).get('/api/v1/tidak-ada');
    expect(res.status).toBe(404);
  });
});