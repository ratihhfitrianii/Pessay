import { signToken, verifyToken } from './jwt.js';

describe('jwt', () => {
  it('sign + verify roundtrip', () => {
    const token = signToken({ id: 42, role: 'guru' });
    const payload = verifyToken(token);
    expect(payload.id).toBe(42);
    expect(payload.role).toBe('guru');
  });

  it('token invalid → throws', () => {
    expect(() => verifyToken('bukan-token')).toThrow();
  });

  it('token expired → throws', () => {
    const jwt = require('jsonwebtoken');
    const token = jwt.sign({ id: 1, role: 'siswa', sub: '1' }, process.env.JWT_SECRET ?? 'x', { expiresIn: '-1s' });
    expect(() => verifyToken(token)).toThrow();
  });
});