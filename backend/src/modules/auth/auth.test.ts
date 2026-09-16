import request from 'supertest';
import { createApp } from '../../app';
import { pool } from '../../lib/pg';
import { cleanupTestData, uniqueEmail, runToken } from '../../test/fixtures';

const app = createApp();

describe('auth', () => {
  afterAll(async () => {
    await cleanupTestData();
  });

  it('login berhasil untuk seed admin', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ identifier: 'admin@pessay.test', password: 'admin123' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.role).toBe('admin');
  });

  it('login gagal dengan password salah → 401', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ identifier: 'admin@pessay.test', password: 'salah' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('login gagal untuk email tidak dikenal → 401', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ identifier: 'tidak-ada@pessay.test', password: 'x' });
    expect(res.status).toBe(401);
  });

  it('validasi body: identifier kosong → 400', async () => {
    const res = await request(app).post('/api/v1/auth/login').send({ identifier: '', password: 'x' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('user baru (guru) bisa login dengan password yang dibuat', async () => {
    const email = uniqueEmail('guru');
    const bcrypt = (await import('bcryptjs')).default;
    await pool.query(
      `INSERT INTO users (email, password_hash, full_name, role_id)
       VALUES ($1, $2, $3, (SELECT id FROM roles WHERE code='guru'))`,
      [email, bcrypt.hashSync('Password123!', 12), `Guru ${runToken()}`],
    );
    const res = await request(app).post('/api/v1/auth/login').send({ identifier: email, password: 'Password123!' });
    expect(res.status).toBe(200);
    expect(res.body.data.user.role).toBe('guru');
  });
});