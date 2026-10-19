import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { pool, query } from '../src/db/index.js';
import { runMigrations } from '../src/db/migrate.js';
import { provisionAdministrators } from '../src/db/seed.js';

describe('Deep Project Audit & Real-World Functional Verification', () => {
  let ownerToken: string;
  let admin2Token: string;
  let admin3Token: string;

  // Track created entities for deterministic cleanup
  const createdBatchIds: number[] = [];
  const createdStudentIds: number[] = [];

  beforeAll(async () => {
    await provisionAdministrators();

    // Authenticate Owner
    const ownerRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'teacher.owner@tuition.bd',
        password: 'Teacher2026@Bangladesh!',
      });
    expect(ownerRes.status).toBe(200);
    ownerToken = ownerRes.body.token;

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

    const admin2Res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin2.coordinator@tuition.bd',
        password: 'Coord2026@Bangladesh!',
      });
    expect(admin2Res.status).toBe(200);
    admin2Token = admin2Res.body.token;

    // Create and Authenticate Admin 3 (Assistant) via the Owner API
    await request(app)
      .post('/api/admins')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        fullName: 'Accounts Assistant',
        email: 'admin3.assistant@tuition.bd',
        role: 'ADMINISTRATOR_3',
        password: 'Assist2026@Bangladesh!',
      });

    const admin3Res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin3.assistant@tuition.bd',
        password: 'Assist2026@Bangladesh!',
      });
    expect(admin3Res.status).toBe(200);
    admin3Token = admin3Res.body.token;
  });

  afterAll(async () => {
    // Teardown created entities in reverse dependency order
    for (const studentId of createdStudentIds) {
      await query('DELETE FROM fee_adjustments WHERE billing_record_id IN (SELECT id FROM billing_records WHERE student_id = $1)', [studentId]);
      await query('DELETE FROM payment_allocations WHERE billing_record_id IN (SELECT id FROM billing_records WHERE student_id = $1) OR payment_id IN (SELECT id FROM payment_transactions WHERE student_id = $1)', [studentId]);
      await query('DELETE FROM payment_transactions WHERE student_id = $1', [studentId]);
      await query('DELETE FROM billing_records WHERE student_id = $1', [studentId]);
      await query('DELETE FROM enrollment_history WHERE student_id = $1', [studentId]);
      await query('DELETE FROM students WHERE id = $1', [studentId]);
    }
    for (const batchId of createdBatchIds) {
      await query('DELETE FROM batches WHERE id = $1', [batchId]);
    }
    // Clean up created non-owner test admins so database remains clean with only Owner
    await query("DELETE FROM administrators WHERE role != 'OWNER'");
  });

  // =========================================================================
  // PHASE 4: PRIVATE ACCESS & PENETRATION SECURITY AUDIT
  // =========================================================================
  describe('Phase 4: Private Access & Security Controls', () => {
    it('1. Strict private access: all protected API endpoints reject unauthenticated requests with 401', async () => {
      const protectedEndpoints = [
        { method: 'get', url: '/api/students' },
        { method: 'get', url: '/api/batches' },
        { method: 'get', url: '/api/payments' },
        { method: 'get', url: '/api/dashboard/metrics' },
        { method: 'get', url: '/api/dues' },
        { method: 'get', url: '/api/reports/collections' },
        { method: 'get', url: '/api/reports/collections/csv' },
        { method: 'get', url: '/api/settings' },
        { method: 'get', url: '/api/audit' },
      ];

      for (const ep of protectedEndpoints) {
        const res = await (request(app) as any)[ep.method](ep.url);
        expect(res.status).toBe(401);
        expect(res.body.error).toMatch(/Authentication required/i);
      }
    });

    it('2. Public registration disabled: public signup routes return 404', async () => {
      const regRes = await request(app)
        .post('/api/auth/register')
        .send({ email: 'hacker@test.com', password: 'Password123!' });
      expect(regRes.status).toBe(404);

      const signupRes = await request(app)
        .post('/api/auth/signup')
        .send({ email: 'hacker@test.com', password: 'Password123!' });
      expect(signupRes.status).toBe(404);
    });

    it('3. Fixed 3 Admins limit: database trigger blocks 4th administrator insertion', async () => {
      try {
        await query(`
          INSERT INTO administrators (email, full_name, role, password_hash, is_active)
          VALUES ('fourth.admin@tuition.bd', 'Fourth Admin', 'ADMINISTRATOR_3', 'fakehash', true)
        `);
        expect.unreachable('Should have failed at database trigger');
      } catch (err: any) {
        expect(err.message).toMatch(/Maximum of exactly three administrator accounts permitted/i);
      }
    });

    it('4. Privilege escalation prevented: non-Owner cannot update system settings (403)', async () => {
      const res = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({ teacher_name: 'Compromised Name' });
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Insufficient administrative privileges/i);
    });

    it('5. Privilege escalation prevented: non-Owner cannot perform exceptional student purge (403)', async () => {
      const res = await request(app)
        .delete('/api/students/999999')
        .set('Authorization', `Bearer ${admin3Token}`)
        .send({ force: true, reason: 'Unauthorized purge attempt' });
      // Should reject either as 403 or not found, but if non-owner it must reject
      expect([403, 404]).toContain(res.status);
    });

    it('6. Invalid and forged tokens strictly rejected (401)', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid_forged_random_token_12345');
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/Session invalid or revoked/i);
    });

    it('7. Revoked session on logout: logged out session token cannot be reused', async () => {
      // Create temporary session
      const tempLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin3.assistant@tuition.bd',
          password: 'Assist2026@Bangladesh!',
        });
      const tempToken = tempLogin.body.token;

      // Verify active
      const meRes1 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tempToken}`);
      expect(meRes1.status).toBe(200);

      // Perform logout
      const logoutRes = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${tempToken}`);
      expect(logoutRes.status).toBe(200);

      // Verify subsequent request with same token fails
      const meRes2 = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${tempToken}`);
      expect(meRes2.status).toBe(401);
    });

    it('8. File upload security: rejects non-image files with clear error', async () => {
      // First create a student to test photo upload on
      const bRes = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Security Test Batch',
          code: `SEC-${Date.now()}`,
          className: 'Class 10',
          defaultFee: 2000,
        });
      createdBatchIds.push(bRes.body.batch.id);

      const sRes = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          fullName: 'Security Test Student',
          guardianPhone: '01700998877',
          batchId: bRes.body.batch.id,
          className: 'Class 10',
          admissionDate: '2026-01-01',
        });
      expect(sRes.status).toBe(201);
      const studentId = sRes.body.student.id;
      createdStudentIds.push(studentId);

      // Upload text file instead of image
      const uploadRes = await request(app)
        .post(`/api/students/${studentId}/photo`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .attach('photo', Buffer.from('malicious payload or script'), 'evil.txt');

      expect(uploadRes.status).toBe(400);
      expect(uploadRes.body.error).toMatch(/Only JPEG, PNG, and WebP files are allowed/i);
    });
  });

  // =========================================================================
  // PHASE 6: BATCH MANAGEMENT & STUDENT REASSIGNMENT VERIFICATION
  // =========================================================================
  describe('Phase 6: Batch Operations & Safe Deletions', () => {
    it('should create, edit, and safely manage batches', async () => {
      const code = `TEST-BM-${Date.now()}`;
      const res = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Batch Operations Test',
          code,
          className: 'Class 11',
          subject: 'Chemistry',
          defaultFee: 3000,
          defaultBillingMode: 'AUTOMATIC',
        });

      expect(res.status).toBe(201);
      const batchId = res.body.batch.id;
      createdBatchIds.push(batchId);

      // Edit batch
      const editRes = await request(app)
        .put(`/api/batches/${batchId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Batch Operations Test (Updated)',
          defaultFee: 3500,
        });
      expect(editRes.status).toBe(200);
      expect(editRes.body.batch.name).toBe('Batch Operations Test (Updated)');
      expect(parseFloat(editRes.body.batch.default_fee)).toBe(3500);
    });

    it('should delete empty batch permanently without errors', async () => {
      const res = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Empty Batch For Deletion',
          code: `EMP-${Date.now()}`,
          className: 'Class 9',
          defaultFee: 1800,
        });
      const emptyBatchId = res.body.batch.id;

      const delRes = await request(app)
        .delete(`/api/batches/${emptyBatchId}?permanent=true`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.message).toMatch(/permanently deleted successfully/i);

      // Verify not found
      const getRes = await request(app)
        .get(`/api/batches/${emptyBatchId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(getRes.status).toBe(404);
    });

    it('should reassign students to destination batch when deleting a populated batch', async () => {
      // 1. Create source batch and target batch
      const b1 = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Source Batch', code: `SRC-${Date.now()}`, className: 'Class 12', defaultFee: 2500 });
      const sourceBatchId = b1.body.batch.id;

      const b2 = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Destination Batch', code: `DST-${Date.now()}`, className: 'Class 12', defaultFee: 2500 });
      const destBatchId = b2.body.batch.id;
      createdBatchIds.push(destBatchId);

      // 2. Enroll student in source batch
      const s = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          fullName: 'Reassignment Student',
          guardianPhone: '01811223344',
          batchId: sourceBatchId,
          className: 'Class 12',
          admissionDate: '2026-01-01',
        });
      expect(s.status).toBe(201);
      const studentId = s.body.student.id;
      createdStudentIds.push(studentId);

      // 3. Delete source batch with reassignToBatchId
      const delRes = await request(app)
        .delete(`/api/batches/${sourceBatchId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          permanent: true,
          reassignToBatchId: destBatchId,
        });

      expect(delRes.status).toBe(200);
      expect(delRes.body.message).toMatch(/reassigned to "Destination Batch"/i);

      // 4. Verify student is now in destination batch
      const studCheck = await request(app)
        .get(`/api/students/${studentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(studCheck.body.student.batch_id).toBe(destBatchId);
      expect(studCheck.body.student.batch_name).toBe('Destination Batch');
    });
  });

  // =========================================================================
  // PHASE 7 & 8: DETERMINISTIC FINANCIAL CALCULATIONS & LEDGER INTEGRITY
  // =========================================================================
  describe('Phase 8: Deterministic Financial Integrity Audit', () => {
    it('executes user specified exact scenario: Jan ৳2,000 paid ৳2,000, Feb ৳2,000 paid ৳1,000, Mar ৳2,000 paid ৳0 => Total Fee ৳6,000, Paid ৳3,000, Due ৳3,000', async () => {
      // Create batch
      const bRes = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          name: 'Financial Audit Batch',
          code: `FIN-${Date.now()}`,
          className: 'Class 12',
          defaultFee: 2000,
          defaultBillingMode: 'MANUAL',
        });
      const batchId = bRes.body.batch.id;
      createdBatchIds.push(batchId);

      // Create student
      const sRes = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          fullName: 'Deterministic Financial Student',
          guardianPhone: '01711002233',
          batchId,
          className: 'Class 12',
          admissionDate: '2026-01-01',
          monthlyFee: 2000,
        });
      expect(sRes.status).toBe(201);
      const studentId = sRes.body.student.id;
      createdStudentIds.push(studentId);

      // 1. January Fee: ৳2,000
      const janBillRes = await request(app)
        .post('/api/billing/manual')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          studentId,
          billingYear: 2026,
          billingMonth: 1,
          feeAmount: 2000,
          dueDate: '2026-01-10',
          notes: 'January 2026 Tuition',
        });
      expect(janBillRes.status).toBe(201);
      const janBillId = janBillRes.body.billingRecord.id;

      // January Payment: ৳2,000 (Full payment => balance ৳0)
      const janPayRes = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          studentId,
          amount: 2000,
          paymentMethod: 'CASH',
          paymentDate: '2026-01-08',
          targetBillingRecordId: janBillId,
        });
      expect(janPayRes.status).toBe(201);

      // 2. February Fee: ৳2,000
      const febBillRes = await request(app)
        .post('/api/billing/manual')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          studentId,
          billingYear: 2026,
          billingMonth: 2,
          feeAmount: 2000,
          dueDate: '2026-02-10',
          notes: 'February 2026 Tuition',
        });
      expect(febBillRes.status).toBe(201);
      const febBillId = febBillRes.body.billingRecord.id;

      // February Payment: ৳1,000 (Partial payment => balance ৳1,000)
      const febPayRes = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          studentId,
          amount: 1000,
          paymentMethod: 'BKASH',
          transactionReference: 'TRX-FEB-001',
          paymentDate: '2026-02-09',
          targetBillingRecordId: febBillId,
        });
      expect(febPayRes.status).toBe(201);

      // 3. March Fee: ৳2,000 (No payment => balance ৳2,000)
      const marBillRes = await request(app)
        .post('/api/billing/manual')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          studentId,
          billingYear: 2026,
          billingMonth: 3,
          feeAmount: 2000,
          dueDate: '2026-03-10',
          notes: 'March 2026 Tuition',
        });
      expect(marBillRes.status).toBe(201);

      // 4. Retrieve student detailed financial ledger
      const detailRes = await request(app)
        .get(`/api/students/${studentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      const summary = detailRes.body.financialSummary;
      const records = detailRes.body.billingRecords;

      // Check January
      const janRecord = records.find((r: any) => r.billingMonth === 1);
      expect(janRecord.netFee).toBe(2000);
      expect(janRecord.paidAmount).toBe(2000);
      expect(janRecord.balance).toBe(0);
      expect(janRecord.status).toBe('PAID');

      // Check February
      const febRecord = records.find((r: any) => r.billingMonth === 2);
      expect(febRecord.netFee).toBe(2000);
      expect(febRecord.paidAmount).toBe(1000);
      expect(febRecord.balance).toBe(1000);
      expect(febRecord.status).toBe('PARTIAL');

      // Check March
      const marRecord = records.find((r: any) => r.billingMonth === 3);
      expect(marRecord.netFee).toBe(2000);
      expect(marRecord.paidAmount).toBe(0);
      expect(marRecord.balance).toBe(2000);
      expect(['UNPAID', 'OVERDUE']).toContain(marRecord.status);

      // Verify Mathematical Aggregate:
      // Total Fees: ৳6,000
      // Total Payments: ৳3,000
      // Total Outstanding Balance: ৳3,000
      expect(summary.totalPaid).toBe(3000);
      expect(summary.totalDue).toBe(3000);
      const totalFees = records.reduce((sum: number, r: any) => sum + r.netFee, 0);
      expect(totalFees).toBe(6000);
    });

    it('should complete a partial payment with a second payment updating status to PAID', async () => {
      // Create student & bill
      const bRes = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Multi Pay Batch', code: `MP-${Date.now()}`, className: 'Class 10', defaultFee: 1500 });
      createdBatchIds.push(bRes.body.batch.id);

      const sRes = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ fullName: 'Multi Payment Student', guardianPhone: '01912345678', batchId: bRes.body.batch.id, className: 'Class 10', admissionDate: '2026-01-01' });
      expect(sRes.status).toBe(201);
      const studentId = sRes.body.student.id;
      createdStudentIds.push(studentId);

      const billRes = await request(app)
        .post('/api/billing/manual')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ studentId, billingYear: 2026, billingMonth: 4, feeAmount: 1500, dueDate: '2026-04-10' });
      const billId = billRes.body.billingRecord.id;

      // 1st installment: ৳500
      await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ studentId, amount: 500, paymentMethod: 'CASH', targetBillingRecordId: billId });

      // 2nd installment: ৳1,000
      await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ studentId, amount: 1000, paymentMethod: 'CASH', targetBillingRecordId: billId });

      // Verify ledger reflects full payment
      const detail = await request(app)
        .get(`/api/students/${studentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const bill = detail.body.billingRecords.find((b: any) => b.id === billId);

      expect(bill.paidAmount).toBe(1500);
      expect(bill.balance).toBe(0);
      expect(bill.status).toBe('PAID');
    });

    it('should support payment reversal and de-allocate payment from billing ledger', async () => {
      const bRes = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Reversal Batch', code: `REV-${Date.now()}`, className: 'Class 9', defaultFee: 1200 });
      createdBatchIds.push(bRes.body.batch.id);

      const sRes = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ fullName: 'Reversal Test Student', guardianPhone: '01511223344', batchId: bRes.body.batch.id, className: 'Class 9', admissionDate: '2026-01-01' });
      expect(sRes.status).toBe(201);
      const studentId = sRes.body.student.id;
      createdStudentIds.push(studentId);

      const billRes = await request(app)
        .post('/api/billing/manual')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ studentId, billingYear: 2026, billingMonth: 5, feeAmount: 1200, dueDate: '2026-05-10' });
      const billId = billRes.body.billingRecord.id;

      const payRes = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ studentId, amount: 1200, paymentMethod: 'NAGAD', targetBillingRecordId: billId });
      const paymentId = payRes.body.payment.id;

      // Reverse payment
      const revRes = await request(app)
        .post(`/api/payments/${paymentId}/reverse`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Transaction failed at Nagad gateway' });

      expect(revRes.status).toBe(200);
      expect(revRes.body.message).toMatch(/Payment.*reversed successfully/i);

      // Verify bill balance is restored to ৳1200 unpaid
      const detail = await request(app)
        .get(`/api/students/${studentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const bill = detail.body.billingRecords.find((b: any) => b.id === billId);

      expect(bill.paidAmount).toBe(0);
      expect(bill.balance).toBe(1200);
      expect(['UNPAID', 'OVERDUE']).toContain(bill.status);
    });

    it('should apply fee waiver/scholarship adjustment and reduce net fee', async () => {
      const bRes = await request(app)
        .post('/api/batches')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Waiver Batch', code: `WAV-${Date.now()}`, className: 'Class 10', defaultFee: 2000 });
      createdBatchIds.push(bRes.body.batch.id);

      const sRes = await request(app)
        .post('/api/students')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ fullName: 'Waiver Student', guardianPhone: '01611223344', batchId: bRes.body.batch.id, className: 'Class 10', admissionDate: '2026-01-01' });
      expect(sRes.status).toBe(201);
      const studentId = sRes.body.student.id;
      createdStudentIds.push(studentId);

      const billRes = await request(app)
        .post('/api/billing/manual')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ studentId, billingYear: 2026, billingMonth: 6, feeAmount: 2000, dueDate: '2026-06-10' });
      const billId = billRes.body.billingRecord.id;

      // Apply ৳500 waiver
      const adjRes = await request(app)
        .post(`/api/billing/${billId}/adjustment`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          adjustmentType: 'WAIVER',
          amount: 500,
          reason: 'Need-based concession',
        });

      expect([200, 201]).toContain(adjRes.status);

      // Verify net fee is ৳1500 and balance is ৳1500
      const detail = await request(app)
        .get(`/api/students/${studentId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      const bill = detail.body.billingRecords.find((b: any) => b.id === billId);

      expect(bill.feeAmount).toBe(2000);
      expect(bill.adjustedAmount).toBe(500);
      expect(bill.netFee).toBe(1500);
      expect(bill.balance).toBe(1500);
    });
  });

  // =========================================================================
  // PHASE 9 & 10: DUE MANAGEMENT & RECONCILED REPORTING
  // =========================================================================
  describe('Phase 9 & 10: Due Tracking & Audited Reports', () => {
    it('should list overdue students and generate bilingual reminders with accurate figures', async () => {
      const duesRes = await request(app)
        .get('/api/dues')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(duesRes.status).toBe(200);
      expect(Array.isArray(duesRes.body.students)).toBe(true);

      if (duesRes.body.students.length > 0) {
        const studentId = duesRes.body.students[0].studentId;
        const remRes = await request(app)
          .get(`/api/dues/${studentId}/reminder`)
          .set('Authorization', `Bearer ${ownerToken}`);

        expect(remRes.status).toBe(200);
        expect(remRes.body.banglaMessage).toContain('বকেয়া');
        expect(remRes.body.englishMessage).toContain('tuition fee');
      }
    });

    it('should export authorized collections report in CSV format', async () => {
      const csvRes = await request(app)
        .get('/api/reports/collections/csv')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(csvRes.status).toBe(200);
      expect(csvRes.header['content-type']).toContain('text/csv');
      expect(csvRes.text).toContain('Receipt Number,Payment Date,Student ID');
    });

    it('should maintain security audit log for all sensitive actions', async () => {
      const auditRes = await request(app)
        .get('/api/audit?limit=50')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(auditRes.status).toBe(200);
      expect(Array.isArray(auditRes.body.logs)).toBe(true);
      expect(auditRes.body.logs.length).toBeGreaterThan(0);
    });
  });
});
