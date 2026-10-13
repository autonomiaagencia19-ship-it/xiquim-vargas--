import request from 'supertest';
import { server } from '../server.js';
import { db } from '../src/db.js';

describe('Users API', () => {
  beforeAll(() => {
    // Basic setup if necessary
  });

  afterAll(() => {
    server.close();
  });

  it('should not allow access to /api/users without authentication', async () => {
    const res = await request(server).get('/api/users');
    expect(res.status).toBe(401);
  });
});
