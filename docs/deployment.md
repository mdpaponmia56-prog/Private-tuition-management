# Production Deployment & Architecture Guide
## Private Tuition Management System (Bangladesh)

---

## 1. Architectural Overview

```
[ Client Browser (Responsive Web App) ]
                │  HTTPS
                ▼
[ Reverse Proxy / Ingress (Nginx / Cloudflare) ]
        │                       │
        ▼                       ▼
[ Frontend SPA (Port 5173 / CDN) ]   [ Backend API (Port 5001) ]
                                                │
                                    (PostgreSQL Connection Pool)
                                                ▼
                                    [ PostgreSQL 14+ / Neon Cloud ]
                                    (Schema, Foreign Keys, Triggers)
```

### Key Security Invariants
1. **Strict Private System**: No public dashboard, student directory, or reports. All routes reject unauthenticated visitors with `401 Unauthorized`.
2. **Fixed Administrator Accounts**: Exactly 3 pre-provisioned administrator accounts (`OWNER`, `ADMINISTRATOR_2`, `ADMINISTRATOR_3`). Public signups are permanently disabled. Insertion of a fourth administrator is blocked at both application and database level by the `enforce_admin_limit()` trigger.
3. **Ledger Integrity**: Financial payments are recorded atomically with database row-level locking (`SELECT ... FOR UPDATE`). Deletions are forbidden on records with ledger activity; corrections must use audited reversals.

---

## 2. Server & Database Provisioning

### Database Requirements
- PostgreSQL 14 or higher (or cloud-managed Neon / AWS RDS / Supabase).
- Ensure SSL connection mode is enabled: `sslmode=require` or `sslmode=verify-full`.

### Migration Execution
Run the automated schema migration to initialize all tables, foreign keys, indexes, and triggers:
```bash
cd backend
npm run db:migrate
```

### Administrator Provisioning
Run the idempotent administrator provisioning command to initialize or update the 3 pre-provisioned admin identities:
```bash
cd backend
npm run provision:admins
```

---

## 3. Environment Variables

### Backend Configuration (`backend/.env`)
| Variable | Description | Example / Default |
|---|---|---|
| `PORT` | API server listening port | `5001` |
| `NODE_ENV` | Environment mode (`development` or `production`) | `production` |
| `CLIENT_URL` | Allowed frontend origin for CORS | `https://tuition.yourdomain.bd` |
| `DATABASE_URL` | PostgreSQL connection URI | `postgresql://user:pass@host:5432/db?sslmode=require` |
| `SESSION_SECRET` | 64-character random string for HMAC tokens | *(Secure Random)* |
| `SESSION_MAX_AGE_DAYS`| Session validity duration in days | `7` |
| `ADMIN1_EMAIL` | Lead Instructor (Owner) email | `teacher.owner@tuition.bd` |
| `ADMIN1_PASSWORD` | Owner initial password | *(Strong Password)* |
| `ADMIN2_EMAIL` | Academic Coordinator email | `admin2.coordinator@tuition.bd` |
| `ADMIN2_PASSWORD` | Coordinator initial password | *(Strong Password)* |
| `ADMIN3_EMAIL` | Accounts Assistant email | `admin3.assistant@tuition.bd` |
| `ADMIN3_PASSWORD` | Assistant initial password | *(Strong Password)* |
| `STORAGE_DIR` | Directory for photo storage | `./uploads` |
| `MAX_PHOTO_SIZE_MB` | Maximum allowed photo upload size | `2` |

---

## 4. Production Deployment Steps

### Option A: Self-Hosted Linux VPS (Ubuntu / Debian / Docker)

1. **Clone repository and install dependencies**:
   ```bash
   git clone <repo-url> /opt/tuition-system
   cd /opt/tuition-system
   npm run install:all
   ```

2. **Configure environment**:
   ```bash
   cp backend/.env.example backend/.env
   nano backend/.env
   ```

3. **Run migrations and build**:
   ```bash
   npm run db:migrate
   npm run provision:admins
   npm run build
   ```

4. **Start backend with PM2 process manager**:
   ```bash
   npm install -g pm2
   cd /opt/tuition-system/backend
   pm2 start dist/app.js --name "tuition-api" --time
   pm2 save
   pm2 startup
   ```

5. **Configure Nginx Reverse Proxy with Let's Encrypt SSL**:
   ```nginx
   server {
       server_name tuition.yourdomain.bd;

       # Frontend static bundle
       location / {
           root /opt/tuition-system/frontend/dist;
           index index.html;
           try_files $uri $uri/ /index.html;
       }

       # Backend API proxy
       location /api/ {
           proxy_pass http://127.0.0.1:5001;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

6. **Issue HTTPS Certificate**:
   ```bash
   sudo certbot --nginx -d tuition.yourdomain.bd
   ```
