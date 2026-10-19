export interface Admin {
  id: number;
  email: string;
  fullName: string;
  role: 'OWNER' | 'ADMINISTRATOR_2' | 'ADMINISTRATOR_3';
}

export interface Batch {
  id: number;
  name: string;
  code: string;
  class_name: string;
  subject: string | null;
  default_fee: string | number;
  default_billing_mode: 'AUTOMATIC' | 'MANUAL';
  billing_day_of_month: number;
  grace_period_days: number;
  start_date: string;
  schedule_text: string | null;
  notes: string | null;
  is_active: boolean;
  active_student_count?: number;
  expected_monthly_fees?: number;
  current_month_collections?: number;
  total_outstanding_dues?: number;
}

export interface Student {
  id: number;
  student_code: string;
  full_name: string;
  student_phone: string | null;
  guardian_phone: string;
  batch_id: number;
  batch_name?: string;
  batch_code?: string;
  class_name: string;
  admission_date: string;
  monthly_fee: string | number | null;
  billing_mode: 'AUTOMATIC' | 'MANUAL' | null;
  billing_start_date: string;
  status: 'ACTIVE' | 'INACTIVE' | 'COMPLETED' | 'ARCHIVED';
  address: string | null;
  notes: string | null;
  photo_filename: string | null;
  total_due?: string | number;
}

export interface BillingRecord {
  id: number;
  studentId: number;
  studentCode: string;
  studentName: string;
  guardianPhone: string;
  batchId: number;
  batchName: string;
  batchCode: string;
  billingYear: number;
  billingMonth: number;
  feeAmount: number;
  adjustedAmount: number;
  netFee: number;
  paidAmount: number;
  balance: number;
  dueDate: string;
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE' | 'WAIVED';
  notes: string | null;
  createdAt: string;
}

export interface PaymentTransaction {
  id: number;
  receipt_number: string;
  payment_date: string;
  amount: string | number;
  payment_method: 'CASH' | 'BKASH' | 'NAGAD' | 'ROCKET' | 'BANK_TRANSFER' | 'OTHER';
  transaction_reference: string | null;
  notes: string | null;
  status: 'COMPLETED' | 'REVERSED';
  reversal_reason: string | null;
  reversed_at: string | null;
  student_id: number;
  student_code: string;
  student_name: string;
  guardian_phone: string;
  batch_name: string;
  recorded_by_admin: string;
}

export interface PaymentReceipt {
  id: number;
  receiptNumber: string;
  paymentDate: string;
  amount: number;
  paymentMethod: string;
  transactionReference: string | null;
  notes: string | null;
  status: 'COMPLETED' | 'REVERSED';
  reversalReason: string | null;
  reversedAt: string | null;
  recordedByAdmin: string;
  student: {
    id: number;
    studentCode: string;
    fullName: string;
    guardianPhone: string;
    batchName: string;
    className: string;
  };
  allocations: Array<{
    billingRecordId: number;
    billingPeriod: string;
    allocatedAmount: number;
    remainingBillBalance: number;
  }>;
  totalStudentOutstandingBalance: number;
}

export interface DueItem {
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

export interface DashboardData {
  cards: {
    activeStudents: number;
    totalBatches: number;
    expectedFees: number;
    collectedFees: number;
    totalOutstanding: number;
    fullyPaidCount: number;
    partialCount: number;
    unpaidCount: number;
    overdueCount: number;
  };
  selectedPeriod: {
    year: number;
    month: number;
  };
  monthlyTrends: Array<{
    label: string;
    year: number;
    month: number;
    expected: number;
    collected: number;
  }>;
  batchBreakdown: Array<{
    id: number;
    name: string;
    code: string;
    studentCount: number;
    collectedAmount: number;
    outstandingDue: number;
  }>;
  recentPayments: any[];
  recentAdmissions: any[];
  followUpAlerts: any[];
  urgentFollowUps?: any[];
}
