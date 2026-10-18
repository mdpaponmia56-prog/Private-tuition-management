# PostgreSQL Backup and Disaster Recovery Guide
## Private Tuition Management System

---

## 1. Backup Strategy Overview

To safeguard the tuition center's financial records, student profiles, and historical payments, follow this automated backup strategy:

- **RPO (Recovery Point Objective)**: 24 hours (Daily automated snapshots).
- **RTO (Recovery Time Objective)**: < 30 minutes.
- **Backup Type**: Full logical dump using PostgreSQL custom format (`pg_dump -F c`).
- **Storage Target**: Off-site private cloud storage (AWS S3, Google Cloud Storage, or Neon automated branch snapshots).

---

## 2. Taking a Manual Database Backup

Export the complete PostgreSQL database including all schemas, tables, constraints, and sequences:

```bash
# Set your active connection string
export DATABASE_URL="postgresql://user:pass@host:5432/tuition_db?sslmode=require"

# Generate compressed custom backup file
pg_dump "$DATABASE_URL" \
  --format=custom \
  --blobs \
  --verbose \
  --file="tuition_backup_$(date +%Y%m%d_%H%M%S).dump"
```

### Encrypting Backup for Off-Site Storage
```bash
gpg --symmetric --cipher-algo AES256 tuition_backup_20261018.dump
# Produces tuition_backup_20261018.dump.gpg
```

---

## 3. Database Restoration Procedure

In the event of disaster or database migration to a new server:

1. **Verify target database is created and accessible**:
   ```bash
   psql "$TARGET_DATABASE_URL" -c "SELECT version();"
   ```

2. **Restore database dump**:
   ```bash
   pg_restore \
     --dbname="$TARGET_DATABASE_URL" \
     --clean \
     --if-exists \
     --verbose \
     tuition_backup_20261018.dump
   ```

3. **Verify record counts and integrity**:
   ```sql
   SELECT 'administrators', count(*) FROM administrators
   UNION ALL
   SELECT 'batches', count(*) FROM batches
   UNION ALL
   SELECT 'students', count(*) FROM students
   UNION ALL
   SELECT 'billing_records', count(*) FROM billing_records
   UNION ALL
   SELECT 'payment_transactions', count(*) FROM payment_transactions;
   ```

---

## 4. Emergency Administrator Credential Recovery

If the Lead Teacher or administrator loses access:
- Public registration remains **strictly disabled**.
- To reset an administrator's credentials without bypassing database security, run the controlled provisioning command on the server:
  ```bash
  ADMIN1_PASSWORD="NewSecurePassword2026!" npm run provision:admins
  ```
- This updates the bcrypt password hash in-place without creating a new identity or violating the 3-administrator invariant.
