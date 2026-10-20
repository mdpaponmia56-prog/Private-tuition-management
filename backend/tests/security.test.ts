import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'fs';
import path from 'path';
import { app } from '../src/app.js';
import { pool, query } from '../src/db/index.js';
import { config } from '../src/config/index.js';
import { provisionAdministrators } from '../src/db/seed.js';

describe('Critical Security Audit & Penetration Testing Suite', () => {
  let ownerToken: string;
  let ownerCookie: string;
  let coordinatorToken: string;
  let coordinatorCookie: string;
  let createdAdminId: number | null = null;

  beforeAll(async () => {
    // Ensure primary owner is provisioned
    await provisionAdministrators();

    // Authenticate Owner
    const ownerRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: config.admin1.email,
        password: config.admin1.password,
      });

    expect(ownerRes.status).toBe(200);
    expect(ownerRes.body.token).toBeDefined();
    ownerToken = ownerRes.body.token;

    // Capture session cookie
    const cookies = ownerRes.headers['set-cookie'];
    if (cookies && cookies.length > 0) {
      ownerCookie = cookies[0].split(';')[0];
    }

    // Clean up any test coordinator from previous runs
    await query("DELETE FROM administrators WHERE email = 'test.coord.sec@tuition.bd'");

    // Create an ADMINISTRATOR_2 account for role-based authorization tests
    const coordCreateRes = await request(app)
      .post('/api/admins')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        fullName: 'Security Test Coordinator',
        email: 'test.coord.sec@tuition.bd',
        role: 'ADMINISTRATOR_2',
        password: 'CoordPassword2026!Sec',
      });

    if (coordCreateRes.status === 201) {
      createdAdminId = coordCreateRes.body.administrator.id;
    }

    const coordLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test.coord.sec@tuition.bd',
        password: 'CoordPassword2026!Sec',
      });

    if (coordLoginRes.status === 200) {
      coordinatorToken = coordLoginRes.body.token;
      const cCookies = coordLoginRes.headers['set-cookie'];
      if (cCookies && cCookies.length > 0) {
        coordinatorCookie = cCookies[0].split(';')[0];
      }
    }
  });

  afterAll(async () => {
    // Clean up created test admin and associated sessions
    if (createdAdminId) {
      await query('DELETE FROM sessions WHERE admin_id = $1', [createdAdminId]);
      await query('DELETE FROM administrators WHERE id = $1', [createdAdminId]);
    }
  });

  // ==========================================================================
  // 1. UNAUTHENTICATED ENDPOINT ACCESS PROTECTION
  // ==========================================================================
  describe('1. Unauthenticated Endpoint Protection (Zero-Trust API)', () => {
    const protectedGetEndpoints = [
      '/api/admins',
      '/api/admin',
      '/api/students',
      '/api/students/1',
      '/api/students/1/photo',
      '/api/batches',
      '/api/billing',
      '/api/billing/pending',
      '/api/payments',
      '/api/dues',
      '/api/dashboard/stats',
      '/api/dashboard/trend',
      '/api/reports/summary',
      '/api/reports/export/csv',
      '/api/settings',
      '/api/audit',
      '/api/audit-logs',
      '/api/auth/me',
    ];

    for (const endpoint of protectedGetEndpoints) {
      it(`denies unauthenticated GET ${endpoint} with 401 Unauthorized`, async () => {
        const res = await request(app).get(endpoint);
        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/Authentication required|Session invalid/i);
      });
    }

    it('denies unauthenticated POST /api/students with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/students')
        .send({ fullName: 'Unauthorized Hacker', studentPhone: '01700000000', batchId: 1 });
      expect(res.status).toBe(401);
    });

    it('denies unauthenticated POST /api/payments with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/payments')
        .send({ studentId: 1, amountPaid: 5000 });
      expect(res.status).toBe(401);
    });

    it('denies unauthenticated POST /api/admins with 401 Unauthorized', async () => {
      const res = await request(app)
        .post('/api/admins')
        .send({ fullName: 'Fake Admin', email: 'fake@admin.com', password: 'FakePassword123!' });
      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // 2. INVALID, TAMPERED & EXPIRED SESSION HANDLING
  // ==========================================================================
  describe('2. Invalid & Tampered Token Protection', () => {
    it('denies request with completely fake Bearer token with 401', async () => {
      const res = await request(app)
        .get('/api/students')
        .set('Authorization', 'Bearer fake_invalid_token_xyz_1234567890');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Session invalid or revoked/i);
    });

    it('denies request with malformed Authorization header with 401', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', 'Basic dXNlcjpwYXNz');
      expect(res.status).toBe(401);
    });

    it('denies request with tampered session cookie with 401', async () => {
      const res = await request(app)
        .get('/api/students')
        .set('Cookie', 'tuition_session=tampered_cookie_value_999');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Session invalid or revoked/i);
    });
  });

  // ==========================================================================
  // 3. ROLE-BASED ACCESS CONTROL (RBAC) & LEAST PRIVILEGE
  // ==========================================================================
  describe('3. Role-Based Access Control (RBAC)', () => {
    it('prevents non-owner administrator from creating a new administrator (403 Forbidden)', async () => {
      const res = await request(app)
        .post('/api/admins')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({
          fullName: 'Attacker Admin',
          email: 'attacker@tuition.bd',
          role: 'OWNER',
          password: 'Password123!Safe',
        });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Insufficient administrative privileges/i);
    });

    it('prevents non-owner administrator from deleting another administrator (403 Forbidden)', async () => {
      const res = await request(app)
        .delete(`/api/admins/${createdAdminId}`)
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Insufficient administrative privileges/i);
    });

    it('prevents non-owner administrator from accessing security audit logs (403 Forbidden)', async () => {
      const res = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${coordinatorToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Insufficient administrative privileges/i);
    });

    it('prevents non-owner administrator from modifying system institution settings (403 Forbidden)', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${coordinatorToken}`)
        .send({ institution_name: 'Hacked Tuition System' });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Insufficient administrative privileges/i);
    });

    it('allows OWNER to access security audit logs with 200 OK', async () => {
      const res = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.logs)).toBe(true);
    });
  });

  // ==========================================================================
  // 4. PRE-PROVISIONED 3-ADMIN LIMIT & REPUTATION CONTROLS
  // ==========================================================================
  describe('4. Strict System Limit: At Most 3 Administrators', () => {
    it('prevents public self-registration (no signup or register endpoint exists)', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({ email: 'newbie@tuition.bd', password: 'Password123!' });
      expect(res.status).toBe(404);
    });

    it('prevents creating more than 3 administrators (database & API invariant)', async () => {
      // Check current count
      const countRes = await query('SELECT COUNT(*) as count FROM administrators');
      const count = parseInt(countRes.rows[0].count, 10);

      // If we have less than 3, add up to 3 to test limit
      const tempIds: number[] = [];
      try {
        for (let i = count; i < 3; i++) {
          const addRes = await request(app)
            .post('/api/admins')
            .set('Authorization', `Bearer ${ownerToken}`)
            .send({
              fullName: `Temp Admin ${i}`,
              email: `temp.admin.${i}@tuition.bd`,
              role: 'ADMINISTRATOR_3',
              password: 'TempPassword2026!Valid',
            });
          if (addRes.status === 201) {
            tempIds.push(addRes.body.administrator.id);
          }
        }

        // Now we are at 3. Attempting to add a 4th admin MUST be rejected
        const fourthAdminRes = await request(app)
          .post('/api/admins')
          .set('Authorization', `Bearer ${ownerToken}`)
          .send({
            fullName: 'Fourth Overflow Admin',
            email: 'overflow.admin@tuition.bd',
            role: 'ADMINISTRATOR_3',
            password: 'OverflowPassword2026!',
          });

        expect(fourthAdminRes.status).toBe(400);
        expect(fourthAdminRes.body.error).toMatch(/Maximum of 3 administrator|System invariant violation/i);
      } finally {
        for (const tid of tempIds) {
          await query('DELETE FROM sessions WHERE admin_id = $1', [tid]);
          await query('DELETE FROM administrators WHERE id = $1', [tid]);
        }
      }
    });

    it('prevents deleting the sole active OWNER account', async () => {
      const ownerRecord = await query("SELECT id FROM administrators WHERE role = 'OWNER' LIMIT 1");
      const ownerId = ownerRecord.rows[0].id;

      const deleteRes = await request(app)
        .delete(`/api/admins/${ownerId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(deleteRes.status).toBe(400);
      expect(deleteRes.body.error).toMatch(/Cannot delete the only Lead Owner/i);
    });
  });

  // ==========================================================================
  // 5. SECURE LOGOUT & SESSION REVOCATION
  // ==========================================================================
  describe('5. Secure Session Invalidation on Logout', () => {
    it('invalidates the session on the server upon logout and rejects subsequent access', async () => {
      // 1. Perform a fresh login to get a distinct ephemeral session
      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: config.admin1.email,
          password: config.admin1.password,
        });
      expect(loginRes.status).toBe(200);
      const tempToken = loginRes.body.token;

      // 2. Verify token works
      const verifyRes1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tempToken}`);
      expect(verifyRes1.status).toBe(200);

      // 3. Logout using that token
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${tempToken}`);
      expect(logoutRes.status).toBe(200);

      // 4. Verify subsequent request with the same token is strictly 401 Unauthorized
      const verifyRes2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tempToken}`);
      expect(verifyRes2.status).toBe(401);
      expect(verifyRes2.body.error).toMatch(/Session invalid or revoked/i);
    });
  });

  // ==========================================================================
  // 6. BRUTE FORCE PROTECTION & ACCOUNT ENUMERATION RESISTANCE
  // ==========================================================================
  describe('6. Login Protection & Enumeration Resistance', () => {
    it('returns generic error on non-existent email (prevents account enumeration)', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent.user.doesnotexist@tuition.bd',
          password: 'RandomPassword123!',
        });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password.');
    });

    it('returns identical generic error on wrong password for existing email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: config.admin1.email,
          password: 'WrongPassword999!',
        });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password.');
    });
  });

  // ==========================================================================
  // 7. FRONTEND PRODUCTION BUNDLE SECURITY AUDIT
  // ==========================================================================
  describe('7. Frontend Production Bundle Secrets Inspection', () => {
    it('verifies dist/assets bundle contains no hardcoded administrator passwords', () => {
      const distDir = path.resolve(process.cwd(), '../frontend/dist/assets');
      if (fs.existsSync(distDir)) {
        const files = fs.readdirSync(distDir);
        const jsFiles = files.filter(f => f.endsWith('.js'));
        expect(jsFiles.length).toBeGreaterThan(0);

        for (const file of jsFiles) {
          const content = fs.readFileSync(path.join(distDir, file), 'utf8');
          // Check that no plaintext passwords from credentials exist in bundle
          expect(content).not.toContain('Teacher2026@Bangladesh!');
          expect(content).not.toContain('Coord2026@Bangladesh!');
          expect(content).not.toContain('Assist2026@Bangladesh!');
          expect(content).not.toContain('Authorized Administrator Identities');
          expect(content).not.toContain('Load & Fill');
        }
      }
    });

    it('verifies dist contains no exposed source map files (.map)', () => {
      const distDir = path.resolve(process.cwd(), '../frontend/dist');
      if (fs.existsSync(distDir)) {
        const checkDir = (dir: string) => {
          const items = fs.readdirSync(dir);
          for (const item of items) {
            const fullPath = path.join(dir, item);
            if (fs.statSync(fullPath).isDirectory()) {
              checkDir(fullPath);
            } else {
              expect(item.endsWith('.map')).toBe(false);
            }
          }
        };
        checkDir(distDir);
      }
    });
  });
});
