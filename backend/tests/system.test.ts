import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool, query } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { provisionAdministrators, seedInitialBatches } from '../src/db/seed.js';

describe('Private Tuition Management System - Full Automated Test Suite', () => {
  let ownerToken: string;
  let admin2Token: string;
  let testBatchId: number;
  let testStudentId: number;
  let testBillingRecordId: number;
  let testPaymentId: number;

  beforeAll(async () => {
    // Run migrations and seeds
    await runMigrations();
    await provisionAdministrators();
    await seedInitialBatches();

    // Authenticate Owner
    const ownerLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'teacher.owner@tuition.bd',
        password: 'Teacher2026@Bangladesh!',
      });
    expect(ownerLogin.status).toBe(200);
    expect(ownerLogin.body.token).toBeDefined();
    ownerToken = ownerLogin.body.token;

    // Create and Authenticate Admin 2 (Coordinator) via the Owner API
    await request(app)
      .post('/api/admins')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        fullName: 'Academic Coordinator',
        email: 'admin2.coordinator@tuition.bd',
        role: 'ADMINISTRATOR_2',
        password: 'Coord2026@Bangladesh!',
      });

    const admin2Login = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin2.coordinator@tuition.bd',
        password: 'Coord2026@Bangladesh!',
      });
    expect(admin2Login.status).toBe(200);
    admin2Token = admin2Login.body.token;
  });

  afterAll(async () => {
    // Clean up created test entities if any
    if (testStudentId) {
      await query('DELETE FROM fee_adjustments WHERE billing_record_id IN (SELECT id FROM billing_records WHERE student_id = $1)', [testStudentId]);
      await query('DELETE FROM payment_allocations WHERE billing_record_id IN (SELECT id FROM billing_records WHERE student_id = $1)', [testStudentId]);
      await query('DELETE FROM payment_transactions WHERE student_id = $1', [testStudentId]);
      await query('DELETE FROM billing_records WHERE student_id = $1', [testStudentId]);
      await query('DELETE FROM enrollment_history WHERE student_id = $1', [testStudentId]);
      await query('DELETE FROM students WHERE id = $1', [testStudentId]);
    }
    if (testBatchId) {
      await query('DELETE FROM batches WHERE id = $1', [testBatchId]);
    }
    // Clean up created non-owner test admins so database remains clean with only Owner
    await query("DELETE FROM administrators WHERE role != 'OWNER'");
  });

  // ==========================================
  // SECTION 1: AUTHENTICATION & ACCESS CONTROL
  // ==========================================
  describe('Authentication & Strict Private Access', () => {
    it('should reject unauthenticated access to protected routes with 401', async () => {
      const res = await request(app).get('/api/students');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Authentication required/i);
    });

    it('should reject invalid credentials with generic error', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'teacher.owner@tuition.bd', password: 'WrongPassword123' });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password.');
    });

    it('should enforce exactly 3 administrator accounts - prevent 4th administrator creation at database level', async () => {
      // Ensure 3 admins exist to test the trigger boundary
      const currentCountRes = await query('SELECT COUNT(*) as count FROM administrators');
      const count = parseInt(currentCountRes.rows[0].count, 10);
      const tempEmails: string[] = [];
      for (let i = count + 1; i <= 3; i++) {
        const email = `temp.admin.${i}.${Date.now()}@tuition.bd`;
        tempEmails.push(email);
        await query(`
          INSERT INTO administrators (email, full_name, role, password_hash, is_active)
          VALUES ('${email}', 'Temp Admin ${i}', 'ADMINISTRATOR_${i}', 'hash', true)
        `);
      }

      try {
        await query(`
          INSERT INTO administrators (email, full_name, role, password_hash, is_active)
          VALUES ('unauthorized.fourth@tuition.bd', 'Hacker Admin', 'ADMINISTRATOR_3', 'hash', true)
        `);
        // If query does not fail, trigger failed
        expect(true).toBe(false);
      } catch (err: any) {
        expect(err.message).toMatch(/Maximum of exactly three administrator accounts permitted/i);
      } finally {
        for (const e of tempEmails) {
          await query('DELETE FROM administrators WHERE email = $1', [e]);
        }
      }
    });

    it('should return current admin profile for authenticated user', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.admin.role).toBe('OWNER');
      expect(res.body.admin.email).toBe('teacher.owner@tuition.bd');
    });

    it('should enforce role restrictions on Owner-only settings update', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ settings: { institution_name: 'Unauthorized Change' } });
      expect(res.status).toBe(403);
    });

    it('should allow Owner to update settings', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ settings: { institution_name: 'Tuition Care' } });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Settings updated successfully/i);
    });
  });

  // ==========================================
  // SECTION 2: BATCH & STUDENT MANAGEMENT
  // ==========================================
  describe('Batch & Student Management', () => {
    it('should create a new batch', async () => {
      const batchCode = `TEST-BATCH-${Date.now().toString().slice(-4)}`;
      const res = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'HSC 2026 Test Physics Batch',
          code: batchCode,
          className: 'HSC 2026',
          subject: 'Physics',
          defaultFee: 2500,
          defaultBillingMode: 'AUTOMATIC',
          billingDayOfMonth: 5,
          gracePeriodDays: 5,
        });
      expect(res.status).toBe(201);
      expect(res.body.batch.id).toBeDefined();
      testBatchId = res.body.batch.id;
    });

    it('should create a student with auto-generated student code and initial enrollment history', async () => {
      const res = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          fullName: 'Rahim Ahmed',
          guardianPhone: '+8801711223344',
          studentPhone: '+8801911223344',
          batchId: testBatchId,
          className: 'HSC 2026',
          monthlyFee: 2500,
          billingMode: 'AUTOMATIC',
          billingStartDate: '2026-01-01',
          address: 'Dhanmondi, Dhaka',
        });
      expect(res.status).toBe(201);
      expect(res.body.student.id).toBeDefined();
      expect(res.body.student.student_code).toMatch(/^STU-\d{4}-\d{4}$/);
      testStudentId = res.body.student.id;
    });

    it('should retrieve student details with initial enrollment history', async () => {
      const res = await request(app)
        .get(`/api/students/${testStudentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.student.full_name).toBe('Rahim Ahmed');
      expect(res.body.enrollmentHistory.length).toBeGreaterThanOrEqual(1);
    });

    it('should search students by guardian phone or student code', async () => {
      const res = await request(app)
        .get('/api/students?search=01711223344')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.students.some((s: any) => s.id === testStudentId)).toBe(true);
    });
  });

  // ==========================================
  // SECTION 3: DUAL BILLING SYSTEM
  // ==========================================
  describe('Dual Billing System (Mode A & Mode B)', () => {
    it('Mode A: should generate monthly recurring billing record for eligible student', async () => {
      const res = await request(app)
        .post('/api/billing/generate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          year: 2026,
          month: 1,
          batchId: testBatchId,
          isPreview: false,
        });
      expect(res.status).toBe(200);
      expect(res.body.generatedCount).toBeGreaterThanOrEqual(1);
    });

    it('Mode A: duplicate protection - re-running generation should skip already-billed students', async () => {
      const res = await request(app)
        .post('/api/billing/generate')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          year: 2026,
          month: 1,
          batchId: testBatchId,
          isPreview: false,
        });
      expect(res.status).toBe(200);
      expect(res.body.generatedCount).toBe(0);
      expect(res.body.skippedCount).toBeGreaterThanOrEqual(1);
    });

    it('Mode B: should allow creating manual fee obligation for another month', async () => {
      const res = await request(app)
        .post('/api/billing/manual')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          studentId: testStudentId,
          billingYear: 2026,
          billingMonth: 11,
          feeAmount: 2500,
          dueDate: '2026-11-25',
          notes: 'Special Exam & Class Fee',
        });
      expect(res.status).toBe(201);
      testBillingRecordId = res.body.record.id;
      expect(res.body.record.feeAmount).toBe(2500);
      expect(res.body.record.status).toBe('UNPAID');
    });

    it('should support fee adjustment / waiver', async () => {
      const res = await request(app)
        .post(`/api/billing/${testBillingRecordId}/adjust`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          adjustmentType: 'WAIVER',
          amount: 500,
          reason: 'Academic Excellence Scholarship',
        });
      expect(res.status).toBe(200);
      expect(res.body.record.adjustedAmount).toBe(500);
      expect(res.body.record.netFee).toBe(2000); // 2500 - 500 = 2000
    });
  });

  // ==========================================
  // SECTION 4: PAYMENT INTEGRITY & LEDGER
  // ==========================================
  describe('Payment Integrity & Financial Ledger', () => {
    it('should record partial payment and accurately update billing status to PARTIAL', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          studentId: testStudentId,
          amount: 1000,
          paymentMethod: 'BKASH',
          transactionReference: 'BKASH987654321',
          billingRecordId: testBillingRecordId,
          notes: 'Partial bKash payment',
        });
      expect(res.status).toBe(201);
      expect(res.body.receipt.receiptNumber).toMatch(/^REC-\d{6}-\d{4}$/);
      expect(res.body.receipt.amount).toBe(1000);
      testPaymentId = res.body.receipt.id;

      // Verify bill status is now PARTIAL
      const billRes = await request(app)
        .get(`/api/billing?studentId=${testStudentId}&billingYear=2026&billingMonth=11`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(billRes.body.records[0].status).toBe('PARTIAL');
      expect(billRes.body.records[0].paidAmount).toBe(1000);
      expect(billRes.body.records[0].balance).toBe(1000); // Net 2000 - 1000 = 1000
    });

    it('should record second payment to complete bill and update status to PAID', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          studentId: testStudentId,
          amount: 1000,
          paymentMethod: 'CASH',
          billingRecordId: testBillingRecordId,
          notes: 'Final cash clearance',
        });
      expect(res.status).toBe(201);

      // Verify bill status is now PAID
      const billRes = await request(app)
        .get(`/api/billing?studentId=${testStudentId}&billingYear=2026&billingMonth=11`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(billRes.body.records[0].status).toBe('PAID');
      expect(billRes.body.records[0].balance).toBe(0);
    });

    it('should allow reprint of receipt without mutating ledger records', async () => {
      const res = await request(app)
        .get(`/api/payments/${testPaymentId}/receipt`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.receipt.id).toBe(testPaymentId);
      expect(res.body.receipt.student.fullName).toBe('Rahim Ahmed');
    });

    it('should support controlled payment reversal with mandatory reason and de-allocate payment', async () => {
      const res = await request(app)
        .post(`/api/payments/${testPaymentId}/reverse`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'bKash transaction charged back by guardian bank' });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/reversed successfully/i);

      // Verify bill balance is restored
      const billRes = await request(app)
        .get(`/api/billing?studentId=${testStudentId}&billingYear=2026&billingMonth=11`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(billRes.body.records[0].paidAmount).toBe(1000); // 2000 total paid - 1000 reversed = 1000
      expect(billRes.body.records[0].status).toBe('PARTIAL');
    });

    it('should prevent duplicate reversal on already-reversed payment', async () => {
      const res = await request(app)
        .post(`/api/payments/${testPaymentId}/reverse`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Second reversal attempt' });
      expect(res.status).toBe(500);
      expect(res.body.error).toMatch(/already been reversed/i);
    });

    it('should prevent permanent deletion of student who has financial records', async () => {
      const res = await request(app)
        .delete(`/api/students/${testStudentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Cannot permanently delete student/i);
    });
  });

  // ==========================================
  // SECTION 5: DUE MANAGEMENT & REMINDERS
  // ==========================================
  describe('Due Management & Reminders', () => {
    it('should list students with outstanding balances', async () => {
      const res = await request(app)
        .get('/api/dues')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.summary.totalDueStudents).toBeGreaterThanOrEqual(1);
      expect(res.body.students.some((s: any) => s.studentId === testStudentId)).toBe(true);
    });

    it('should generate polite Bangla and English reminders with real figures', async () => {
      const res = await request(app)
        .get(`/api/dues/${testStudentId}/reminder`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.banglaMessage).toContain('শ্রদ্ধেয় অভিভাবক');
      expect(res.body.banglaMessage).toContain('Rahim Ahmed');
      expect(res.body.englishMessage).toContain('Dear Guardian');
      expect(res.body.englishMessage).toContain('Rahim Ahmed');
    });
  });

  // ==========================================
  // SECTION 6: DASHBOARD, REPORTS & EXPORT
  // ==========================================
  describe('Dashboard, Reports & CSV Export', () => {
    it('should load dashboard aggregations derived from real database records', async () => {
      const res = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.cards.activeStudents).toBeGreaterThanOrEqual(1);
      expect(res.body.monthlyTrends.length).toBe(6);
      expect(res.body.recentPayments.length).toBeGreaterThanOrEqual(1);
    });

    it('should export authorized collections CSV report', async () => {
      const res = await request(app)
        .get('/api/reports/export/collections.csv')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      expect(res.text).toContain('Receipt Number');
    });

    it('should verify audit logs contain record of security and financial events', async () => {
      const res = await request(app)
        .get('/api/audit')
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.logs.length).toBeGreaterThanOrEqual(5);
      const actions = res.body.logs.map((l: any) => l.action);
      expect(actions).toContain('RECORD_PAYMENT');
      expect(actions).toContain('REVERSE_PAYMENT');
      expect(actions).toContain('CREATE_STUDENT');
    });
  });
});
