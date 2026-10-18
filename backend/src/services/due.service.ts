import { query } from '../db/index.js';

export interface DueStudentItem {
  studentId: number;
  studentCode: string;
  studentName: string;
  guardianPhone: string;
  studentPhone: string | null;
  batchId: number;
  batchName: string;
  className: string;
  billingMode: string;
  totalOutstandingDue: number;
  overdueMonthsCount: number;
  oldestBillingPeriod: string;
  lastPaymentDate: string | null;
  lastPaymentAmount: number | null;
}

export class DueService {
  /**
   * Get list of all students with outstanding dues
   */
  public static async getDueStudents(filters: {
    batchId?: number;
    search?: string;
    minDue?: number;
  }): Promise<{
    summary: {
      totalDueAmount: number;
      totalDueStudents: number;
      overdueStudentsCount: number;
    };
    students: DueStudentItem[];
  }> {
    let sql = `
      WITH student_due_calc AS (
        SELECT 
          s.id as student_id,
          s.student_code,
          s.full_name as student_name,
          s.guardian_phone,
          s.student_phone,
          s.class_name,
          COALESCE(s.billing_mode, b.default_billing_mode) as billing_mode,
          b.id as batch_id,
          b.name as batch_name,
          br.id as bill_id,
          br.billing_year,
          br.billing_month,
          br.due_date,
          (br.fee_amount - br.adjusted_amount) as net_fee,
          COALESCE(
            (
              SELECT SUM(pa.allocated_amount)
              FROM payment_allocations pa
              JOIN payment_transactions pt ON pa.payment_id = pt.id
              WHERE pa.billing_record_id = br.id AND pt.status = 'COMPLETED'
            ), 0
          ) as paid_amount
        FROM students s
        JOIN batches b ON s.batch_id = b.id
        JOIN billing_records br ON s.id = br.student_id
        WHERE s.status = 'ACTIVE'
      ),
      unpaid_bills AS (
        SELECT 
          *,
          (net_fee - paid_amount) as bill_balance,
          CASE WHEN CURRENT_DATE > due_date AND paid_amount < net_fee THEN 1 ELSE 0 END as is_overdue
        FROM student_due_calc
        WHERE (net_fee - paid_amount) > 0
      )
      SELECT 
        student_id,
        student_code,
        student_name,
        guardian_phone,
        student_phone,
        batch_id,
        batch_name,
        class_name,
        billing_mode,
        SUM(bill_balance) as total_due,
        COUNT(bill_id) as unpaid_bills_count,
        SUM(is_overdue) as overdue_bills_count,
        MIN(billing_year || '-' || LPAD(billing_month::text, 2, '0')) as oldest_period,
        (
          SELECT pt.payment_date 
          FROM payment_transactions pt 
          WHERE pt.student_id = unpaid_bills.student_id AND pt.status = 'COMPLETED' 
          ORDER BY pt.payment_date DESC, pt.id DESC LIMIT 1
        ) as last_payment_date,
        (
          SELECT pt.amount 
          FROM payment_transactions pt 
          WHERE pt.student_id = unpaid_bills.student_id AND pt.status = 'COMPLETED' 
          ORDER BY pt.payment_date DESC, pt.id DESC LIMIT 1
        ) as last_payment_amount
      FROM unpaid_bills
      WHERE 1=1
    `;
    const params: any[] = [];

    if (filters.batchId) {
      params.push(filters.batchId);
      sql += ` AND batch_id = $${params.length}`;
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      sql += ` AND (student_name ILIKE $${params.length} OR student_code ILIKE $${params.length} OR guardian_phone ILIKE $${params.length})`;
    }

    sql += `
      GROUP BY student_id, student_code, student_name, guardian_phone, student_phone, batch_id, batch_name, class_name, billing_mode
    `;

    if (filters.minDue) {
      params.push(filters.minDue);
      sql += ` HAVING SUM(bill_balance) >= $${params.length}`;
    }

    sql += ` ORDER BY total_due DESC, oldest_period ASC`;

    const res = await query(sql, params);

    let totalDueAmount = 0;
    let overdueStudentsCount = 0;

    const students: DueStudentItem[] = res.rows.map((row: any) => {
      const due = parseFloat(row.total_due || '0');
      const overdueBills = parseInt(row.overdue_bills_count || '0', 10);
      totalDueAmount += due;
      if (overdueBills > 0) {
        overdueStudentsCount++;
      }

      return {
        studentId: row.student_id,
        studentCode: row.student_code,
        studentName: row.student_name,
        guardianPhone: row.guardian_phone,
        studentPhone: row.student_phone,
        batchId: row.batch_id,
        batchName: row.batch_name,
        className: row.class_name,
        billingMode: row.billing_mode,
        totalOutstandingDue: due,
        overdueMonthsCount: parseInt(row.unpaid_bills_count || '0', 10),
        oldestBillingPeriod: row.oldest_period || 'N/A',
        lastPaymentDate: row.last_payment_date ? (row.last_payment_date instanceof Date ? row.last_payment_date.toISOString().slice(0, 10) : String(row.last_payment_date)) : null,
        lastPaymentAmount: row.last_payment_amount ? parseFloat(row.last_payment_amount) : null,
      };
    });

    return {
      summary: {
        totalDueAmount,
        totalDueStudents: students.length,
        overdueStudentsCount,
      },
      students,
    };
  }

  /**
   * Generate polite Bangla and English reminders for a student
   */
  public static async generateReminderText(studentId: number): Promise<{
    studentName: string;
    guardianPhone: string;
    totalDue: number;
    unpaidMonths: string[];
    banglaMessage: string;
    englishMessage: string;
  }> {
    const studentRes = await query(
      `SELECT s.full_name, s.guardian_phone, b.name as batch_name 
       FROM students s JOIN batches b ON s.batch_id = b.id WHERE s.id = $1`,
      [studentId]
    );

    if (studentRes.rows.length === 0) {
      throw new Error('Student not found.');
    }

    const student = studentRes.rows[0];

    // Get settings for contact & name
    const settingsRes = await query(
      `SELECT key, value FROM application_settings WHERE key IN ('institution_name', 'institution_contact')`
    );
    const settingsMap: Record<string, string> = {};
    settingsRes.rows.forEach((r) => {
      settingsMap[r.key] = r.value;
    });

    const instName = settingsMap['institution_name'] || 'Private Tuition Care';
    const instContact = settingsMap['institution_contact'] || '';

    // Get unpaid bills
    const billsRes = await query(
      `SELECT 
        br.billing_year,
        br.billing_month,
        (br.fee_amount - br.adjusted_amount) as net_fee,
        COALESCE(
          (
            SELECT SUM(pa.allocated_amount)
            FROM payment_allocations pa
            JOIN payment_transactions pt ON pa.payment_id = pt.id
            WHERE pa.billing_record_id = br.id AND pt.status = 'COMPLETED'
          ), 0
        ) as paid_amount
       FROM billing_records br
       WHERE br.student_id = $1
       ORDER BY br.billing_year ASC, br.billing_month ASC`,
      [studentId]
    );

    const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNamesBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

    let totalDue = 0;
    const unpaidPeriodsEn: string[] = [];
    const unpaidPeriodsBn: string[] = [];

    for (const b of billsRes.rows) {
      const balance = parseFloat(b.net_fee) - parseFloat(b.paid_amount);
      if (balance > 0) {
        totalDue += balance;
        const mIdx = b.billing_month - 1;
        unpaidPeriodsEn.push(`${monthNamesEn[mIdx]} ${b.billing_year}`);
        unpaidPeriodsBn.push(`${monthNamesBn[mIdx]} ${b.billing_year}`);
      }
    }

    const banglaMessage = `শ্রদ্ধেয় অভিভাবক, আসসালামু আলাইকুম। আপনার সন্তান ${student.full_name} (${student.batch_name})-এর বকেয়া টিউশন ফি ৳${totalDue.toLocaleString('en-US')} (${unpaidPeriodsBn.join(', ')})। অনুগ্রহপূর্বক দ্রুত পরিশোধ করার অনুরোধ জানাচ্ছি। ধন্যবাদ - ${instName} (${instContact})।`;

    const englishMessage = `Dear Guardian, Greetings from ${instName}. This is a gentle reminder that ${student.full_name} (${student.batch_name}) has an outstanding tuition fee of ৳${totalDue.toLocaleString('en-US')} (${unpaidPeriodsEn.join(', ')}) for tuition fees. Kindly arrange payment at your earliest convenience. Thank you. Contact: ${instContact}.`;

    return {
      studentName: student.full_name,
      guardianPhone: student.guardian_phone,
      totalDue,
      unpaidMonths: unpaidPeriodsEn,
      banglaMessage,
      englishMessage,
    };
  }
}
