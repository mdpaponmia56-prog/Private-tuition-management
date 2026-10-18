export type Language = 'en' | 'bn';
export { useLanguage } from '../contexts/LanguageContext.js';

export const translations = {
  en: {
    // Nav
    appName: 'Tuition Care',
    dashboard: 'Dashboard',
    students: 'Students',
    batches: 'Batches',
    feeCollection: 'Fee Collection',
    dueManagement: 'Due Management',
    paymentHistory: 'Payment History',
    reports: 'Reports',
    settings: 'Settings',
    auditLogs: 'Audit Logs',
    logout: 'Log Out',
    changePassword: 'Change Password',

    // Dashboard
    activeStudents: 'Active Students',
    totalBatches: 'Total Batches',
    expectedFeesThisMonth: 'Expected Fees (This Month)',
    collectedFeesThisMonth: 'Collected Fees (This Month)',
    totalOutstandingDues: 'Total Outstanding Dues',
    overdueStudents: 'Overdue Students',
    fullyPaidStudents: 'Fully Paid (This Month)',
    partialAndUnpaid: 'Partial & Unpaid',
    monthlyCollectionTrends: 'Monthly Fee Collection Trends',
    batchPerformance: 'Batch Performance Breakdown',
    recentPayments: 'Recent Payments',
    recentAdmissions: 'Recent Student Admissions',
    urgentFollowUps: 'Urgent Overdue Follow-ups',
    viewAll: 'View All',
    collectFeeNow: 'Collect Fee',

    // Common Actions
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    archive: 'Archive',
    restore: 'Restore',
    edit: 'Edit',
    search: 'Search...',
    filter: 'Filter',
    all: 'All',
    status: 'Status',
    actions: 'Actions',
    close: 'Close',
    print: 'Print Receipt',
    sendReminder: 'Send Reminder',
    exportCsv: 'Export CSV',
    loading: 'Loading data...',
    noData: 'No records found.',
    reverse: 'Reverse Payment',

    // Student fields
    studentId: 'Student ID',
    fullName: 'Full Name',
    guardianPhone: 'Guardian Phone',
    studentPhone: 'Student Phone',
    batch: 'Batch',
    class: 'Class / Session',
    monthlyFee: 'Monthly Fee',
    billingMode: 'Billing Mode',
    balanceDue: 'Balance Due',
    admissionDate: 'Admission Date',
    address: 'Address',
    notes: 'Notes',
    photo: 'Photo',

    // Billing & Payment
    receiptNumber: 'Receipt #',
    amount: 'Amount',
    paymentDate: 'Payment Date',
    paymentMethod: 'Payment Method',
    transactionRef: 'Trx Ref (bKash/Nagad/Bank)',
    allocatedTo: 'Allocated To',
    unpaid: 'Unpaid',
    partial: 'Partial',
    paid: 'Paid',
    overdue: 'Overdue',
    waived: 'Waived',
    automaticMode: 'Automatic (Monthly)',
    manualMode: 'Manual Recording',
    generateMonthlyBills: 'Generate Monthly Bills',
    generatePreview: 'Preview Bills',
    confirmGeneration: 'Confirm & Generate Bills',
    dueDate: 'Due Date',

    // Due & Reminder
    overdueMonths: 'Overdue Months',
    oldestDue: 'Oldest Due Period',
    lastPayment: 'Last Payment',
    reminderTextBn: 'Bangla Reminder (SMS / WhatsApp)',
    reminderTextEn: 'English Reminder (SMS / WhatsApp)',
    copyMessage: 'Copy Message',
    openWhatsApp: 'Send via WhatsApp',

    // Settings
    tuitionCenterProfile: 'Tuition Center Profile',
    centerName: 'Center / Teacher Name',
    contactNumber: 'Contact Number',
    officialAddress: 'Center Address',
    preProvisionedAdmins: 'Pre-Provisioned Administrator Identities (Fixed: 3)',
    securityNotice: 'Strict security policy: Exactly 3 authorized administrator accounts are pre-provisioned. Public signup and dynamic admin creation are permanently prohibited.',
  },

  bn: {
    // Nav
    appName: 'টিউশন কেয়ার',
    dashboard: 'ড্যাশবোর্ড',
    students: 'শিক্ষার্থীবৃন্দ',
    batches: 'ব্যাচসমূহ',
    feeCollection: 'ফি কালেকশন',
    dueManagement: 'বকেয়া ব্যবস্থাপনা',
    paymentHistory: 'পেমেন্ট হিস্ট্রি',
    reports: 'রিপোর্টস',
    settings: 'সেটিংস',
    auditLogs: 'অডিট লগ',
    logout: 'লগআউট',
    changePassword: 'পাসওয়ার্ড পরিবর্তন',

    // Dashboard
    activeStudents: 'সক্রিয় শিক্ষার্থী',
    totalBatches: 'মোট ব্যাচ',
    expectedFeesThisMonth: 'চলতি মাসের সম্ভাব্য ফি',
    collectedFeesThisMonth: 'চলতি মাসের আদায়কৃত ফি',
    totalOutstandingDues: 'সর্বমোট বকেয়া ফি',
    overdueStudents: 'বকেয়াদার শিক্ষার্থী',
    fullyPaidStudents: 'পরিশোধিত (চলতি মাস)',
    partialAndUnpaid: 'আংশিক ও অপরিশোধিত',
    monthlyCollectionTrends: 'মাসিক ফি আদায়ের চিত্র',
    batchPerformance: 'ব্যাচওয়ারী আদায় ও বকেয়া',
    recentPayments: 'সাম্প্রতিক পেমেন্ট',
    recentAdmissions: 'সাম্প্রতিক ভর্তি',
    urgentFollowUps: 'জরুরি তাগাদা তালিকা',
    viewAll: 'সবগুলো দেখুন',
    collectFeeNow: 'ফি গ্রহণ করুন',

    // Common Actions
    save: 'সংরক্ষণ করুন',
    cancel: 'বাতিল',
    delete: 'মুছুন',
    archive: 'আর্কাইভ করুন',
    restore: 'পুনরুদ্ধার',
    edit: 'সম্পাদনা',
    search: 'খুঁজুন...',
    filter: 'ফিল্টার',
    all: 'সকল',
    status: 'অবস্থা',
    actions: 'অ্যাকশন',
    close: 'বন্ধ করুন',
    print: 'রসিদ প্রিন্ট করুন',
    sendReminder: 'তাগাদা পাঠান',
    exportCsv: 'এক্সপোর্ট সিএসভি',
    loading: 'লোড হচ্ছে...',
    noData: 'কোন তথ্য পাওয়া যায়নি।',
    reverse: 'পেমেন্ট বাতিল (রিভার্স)',

    // Student fields
    studentId: 'আইডি',
    fullName: 'পূর্ণ নাম',
    guardianPhone: 'অভিভাবকের মোবাইল',
    studentPhone: 'শিক্ষার্থীর মোবাইল',
    batch: 'ব্যাচ',
    class: 'শ্রেণি / সেশন',
    monthlyFee: 'মাসিক ফি',
    billingMode: 'বিলিং মোড',
    balanceDue: 'বকেয়া পরিমাণ',
    admissionDate: 'ভর্তির তারিখ',
    address: 'ঠিকানা',
    notes: 'মন্তব্য',
    photo: 'ছবি',

    // Billing & Payment
    receiptNumber: 'রসিদ নং',
    amount: 'টাকার পরিমাণ',
    paymentDate: 'পেমেন্টের তারিখ',
    paymentMethod: 'পেমেন্ট মাধ্যম',
    transactionRef: 'ট্রানজেকশন আইডি',
    allocatedTo: 'যে মাসে বরাদ্দ',
    unpaid: 'অপরিশোধিত',
    partial: 'আংশিক',
    paid: 'পরিশোধিত',
    overdue: 'মেয়াদোত্তীর্ণ',
    waived: 'মওকুফ',
    automaticMode: 'অটোমেটিক (মাসিক)',
    manualMode: 'ম্যানুয়াল রেকর্ড',
    generateMonthlyBills: 'মাসিক বিল তৈরি করুন',
    generatePreview: 'বিল প্রিভিউ',
    confirmGeneration: 'বিল নিশ্চিত করুন',
    dueDate: 'পরিশোধের শেষ তারিখ',

    // Due & Reminder
    overdueMonths: 'বকেয়া মাস সংখ্যা',
    oldestDue: 'প্রাচীনতম বকেয়া মাস',
    lastPayment: 'সর্বশেষ পেমেন্ট',
    reminderTextBn: 'বাংলা তাগাদা বার্তা (SMS / WhatsApp)',
    reminderTextEn: 'ইংরেজি বার্তা',
    copyMessage: 'বার্তা কপি করুন',
    openWhatsApp: 'হোয়াটসঅ্যাপে পাঠান',

    // Settings
    tuitionCenterProfile: 'টিউশন সেন্টার পরিচিতি',
    centerName: 'শিক্ষক / সেন্টারের নাম',
    contactNumber: 'যোগাযোগ নম্বর',
    officialAddress: 'ঠিকানা',
    preProvisionedAdmins: 'নির্ধারিত ৩ জন অ্যাডমিনিস্ট্রেটর',
    securityNotice: 'নিরাপত্তা নীতিমালা: এই সিস্টেমে শুধুমাত্র নির্দিষ্ট ৩ জন অনুমোদিত অ্যাডমিনিস্ট্রেটর রয়েছেন। বাইরে থেকে কোনো অ্যাকাউন্ট খোলার সুযোগ নেই।',
  },
};

export function formatBDT(amount: number | string | null | undefined, lang: Language = 'en'): string {
  const num = typeof amount === 'number' ? amount : parseFloat(String(amount || 0));
  if (isNaN(num)) return '৳ 0';

  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  if (lang === 'bn') {
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    const bnFormatted = formatted.replace(/[0-9]/g, (d) => bnDigits[parseInt(d, 10)]);
    return `৳ ${bnFormatted}`;
  }

  return `৳ ${formatted}`;
}
