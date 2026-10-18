# Private Tuition Management System (Bangladesh)
### প্রাইভেট টিউশন ও ব্যাচ ফি ম্যানেজমেন্ট সিস্টেম

A production-ready, secure, and complete Private Tuition Management System built for private tutors and academic coaching centers in Bangladesh. Features multi-batch student tracking, tuition fee billing, partial payments, outstanding due tracking, bilingual reminders, printable money receipts, and an immutable financial ledger.

---

## 🌟 Core Features & Invariants

1. **Strict Private System**:
   - `/login` is the only public interface.
   - All dashboard, student records, fee figures, and photos are strictly protected by session authentication.
2. **Exactly Three Fixed Administrator Identities**:
   - Enforced by both application authorization and database triggers (`enforce_admin_limit()`).
   - Public registration and unauthorized 4th administrator creation are permanently prohibited.
   - Pre-provisioned identities:
     - **Owner (Lead Teacher)**: Full business, financial, and settings management.
     - **Administrator 2 (Academic Coordinator)**: Student, batch, billing, and payment management.
     - **Administrator 3 (Accounts Assistant)**: Student, batch, billing, and payment management.
3. **Dual Billing System**:
   - **Mode A (Automatic Monthly Recurring)**: Generates monthly fee obligations for eligible active students with configurable billing days, grace periods, and duplicate-prevention constraints.
   - **Mode B (Manual Payment Recording)**: Allows recording payments anytime money is received, partial payments, multiple transactions, and manual fee obligations.
   - Clear precedence hierarchy: Student individual override → Batch default → System default.
4. **Financial Ledger & Payment Integrity**:
   - Financial ledger distinguishes fee obligations, payments received, and allocations.
   - Integer/numeric currency precision (`NUMERIC(12, 2)`), preventing floating-point arithmetic errors.
   - Atomic database transactions with row-level locks (`SELECT ... FOR UPDATE`).
   - Controlled payment reversal workflow with mandatory audit reason (never silent deletion).
   - Instant printable Money Receipts (`window.print()`).
5. **Outstanding Due Management & Bilingual Reminders**:
   - Real-time calculation of student dues, overdue months count, and oldest unpaid period.
   - One-click copy and WhatsApp direct links for polite Bangla and English fee reminders.
6. **Bilingual User Interface**:
   - English and Bangla (বাংলা) toggle with Bengali numerals and BDT (৳) currency formatting.
   - Default Timezone: `Asia/Dhaka` (UTC+6).

---

## 🏗️ Technology Stack

- **Backend**: Node.js, Express (TypeScript), PostgreSQL connection pool (`pg`), `bcryptjs`, `express-rate-limit`, `helmet`, `cookie-parser`, `multer`, `csv-stringify`.
- **Database**: PostgreSQL 18 (Neon cloud database with connection pooling and SSL).
- **Frontend**: Vite, React 18, TypeScript, Lucide Icons, Vanilla CSS Design System (Tailwind-free).
- **Testing**: Vitest, Supertest (25 passing automated tests).

---

## 🚀 Quick Start / Local Development

### Prerequisites
- Node.js v20+ and npm v10+
- PostgreSQL database (or use the configured Neon cloud instance in `.env`)

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Configure Environment
Verify `backend/.env` has the active PostgreSQL `DATABASE_URL` and `SESSION_SECRET`:
```bash
cp backend/.env.example backend/.env
```

### 3. Run Database Migrations & Provision 3 Admins
```bash
# Execute schema migration
npm run db:migrate

# Provision the 3 administrator accounts
npm run provision:admins
```

### 4. Start Development Servers
```bash
# Runs both backend (port 5001) and frontend (port 5173) concurrently:
npm run dev
```

Open `http://localhost:5173` in your browser.

---

## 🔐 Pre-Provisioned Administrator Credentials

The system comes pre-provisioned with the exactly 3 authorized identities:

| Account | Email | Initial Password | Role |
|---|---|---|---|
| **1. Lead Teacher (Owner)** | `teacher.owner@tuition.bd` | `Teacher2026@Bangladesh!` | `OWNER` |
| **2. Academic Coordinator** | `admin2.coordinator@tuition.bd` | `Coord2026@Bangladesh!` | `ADMINISTRATOR_2` |
| **3. Accounts Assistant** | `admin3.assistant@tuition.bd` | `Assist2026@Bangladesh!` | `ADMINISTRATOR_3` |

*(Tip: On the `/login` screen, click any of the 3 quick-fill buttons to test each account seamlessly).*

---

## 🧪 Automated Testing

Run the full automated test suite against the PostgreSQL database:
```bash
npm test
```

### Test Coverage Highlights (25/25 Tests Passing):
- Authentication & unauthenticated route rejection (401).
- Generic invalid login errors (prevents account enumeration).
- Database-level trigger preventing 4th administrator account insertion.
- Role-based authorization for Owner-only settings updates.
- Student creation with auto-generated code (`STU-YYYY-XXXX`) and initial enrollment history.
- Mode A recurring billing generation & duplicate prevention.
- Mode B manual billing obligations & fee adjustments (waiver/scholarship).
- Partial payments, secondary payments, and balance calculations.
- Reprinting money receipts without ledger mutation.
- Controlled payment reversal with audit reason & ledger de-allocation.
- Prevention of permanent deletion for students with financial history.
- Due calculation and bilingual reminder generation.
- Real database-derived dashboard statistics and 6-month collection trends.
- Authorized CSV export of collections and dues.
- Immutable audit log tracking.

---

## 📂 Project Structure

```
├── backend/
│   ├── src/
│   │   ├── config/             # Environment config and constants
│   │   ├── db/
│   │   │   ├── index.ts        # PostgreSQL pool & transaction helper
│   │   │   ├── schema.sql      # Database schema, triggers, and constraints
│   │   │   ├── migrate.ts      # Migration runner
│   │   │   └── seed.ts         # 3 Admin provisioning & initial sample batches
│   │   ├── middleware/         # Auth, upload, audit, and error handlers
│   │   ├── routes/             # Auth, batch, student, billing, payment, due, dashboard, reports, settings, audit
│   │   ├── services/           # BillingService, PaymentService, DueService
│   │   └── app.ts              # Express application setup
│   ├── tests/
│   │   └── system.test.ts      # 25 automated integration tests
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/         # Navbar, Sidebar, ReceiptModal, ReminderModal, ChangePasswordModal
│   │   ├── contexts/           # AuthContext, LanguageContext
│   │   ├── pages/              # Login, Dashboard, Students, StudentDetail, Batches, FeeCollection, DueManagement, PaymentHistory, Reports, Settings, AuditLogs
│   │   ├── styles/             # Vanilla CSS design system, print stylesheets
│   │   ├── types/              # TypeScript models
│   │   └── utils/              # i18n, BDT currency formatter, API client
│   └── vite.config.ts
├── docs/
│   ├── deployment.md           # Production deployment & Nginx SSL guide
│   └── backup_and_recovery.md  # PostgreSQL pg_dump backup & disaster recovery
├── package.json
└── README.md
```

---

## 📄 License & Confidentiality
Private software built exclusively for Private Tuition Management in Bangladesh. All rights reserved.
