import bcrypt from 'bcryptjs';
import { pool, query, withTransaction } from './index.js';
import { config } from '../config/index.js';

export async function provisionAdministrators() {
  console.log('[Provisioning] Initializing primary owner account...');

  const primaryOwner = {
    id: 1,
    email: config.admin1.email.toLowerCase().trim(),
    fullName: config.admin1.name.trim(),
    role: config.admin1.role,
    password: config.admin1.password,
  };

  await withTransaction(async (client) => {
    // Check if primary owner already exists
    const existing = await client.query(
      'SELECT id, email, role FROM administrators WHERE email = $1 OR id = $2',
      [primaryOwner.email, primaryOwner.id]
    );

    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(primaryOwner.password, saltRounds);

    if (existing.rows.length === 0) {
      // Check current count
      const countRes = await client.query('SELECT COUNT(*) as count FROM administrators');
      if (parseInt(countRes.rows[0].count, 10) >= 3) {
        throw new Error('Cannot provision: Limit of 3 administrators has already been reached.');
      }

      await client.query(
        `INSERT INTO administrators (id, email, full_name, role, password_hash, is_active)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [primaryOwner.id, primaryOwner.email, primaryOwner.fullName, primaryOwner.role, passwordHash]
      );
      console.log(`[Provisioning] Created Primary Administrator: ${primaryOwner.email} (${primaryOwner.role})`);
    } else {
      // Ensure primary owner retains OWNER role
      await client.query(
        `UPDATE administrators 
         SET email = $1, full_name = $2, role = 'OWNER', is_active = true, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3`,
        [primaryOwner.email, primaryOwner.fullName, existing.rows[0].id]
      );
      console.log(`[Provisioning] Verified Primary Administrator: ${primaryOwner.email} (OWNER)`);
    }

    // Reset sequence if needed
    await client.query(`SELECT setval(pg_get_serial_sequence('administrators', 'id'), coalesce(max(id), 1)) FROM administrators`);
  });

  const countRes = await query('SELECT COUNT(*) as count FROM administrators');
  console.log(`[Provisioning] Primary administrator active. Current administrators: ${countRes.rows[0].count}/3`);
}

// Seed sample batches if none exist
export async function seedInitialBatches() {
  const batchCountRes = await query('SELECT COUNT(*) as count FROM batches');
  if (parseInt(batchCountRes.rows[0].count, 10) === 0) {
    console.log('[Seeding] Creating initial sample batches for Bangladesh tuition center...');
    await query(`
      INSERT INTO batches (name, code, class_name, subject, default_fee, default_billing_mode, billing_day_of_month, grace_period_days, schedule_text)
      VALUES 
        ('HSC 2026 Higher Math Morning', 'HSC-HM-M01', 'HSC 2026', 'Higher Mathematics', 2500.00, 'AUTOMATIC', 5, 5, 'Sun, Tue, Thu 7:30 AM - 9:00 AM'),
        ('HSC 2026 Physics Special', 'HSC-PHY-S01', 'HSC 2026', 'Physics 1st & 2nd Paper', 3000.00, 'AUTOMATIC', 5, 5, 'Sat, Mon, Wed 4:00 PM - 5:30 PM'),
        ('SSC 2026 General Science Evening', 'SSC-SCI-E01', 'Class 10', 'General Science & Math', 2000.00, 'MANUAL', 1, 7, 'Sun, Tue, Thu 5:30 PM - 7:00 PM')
      ON CONFLICT (code) DO NOTHING;
    `);
    console.log('[Seeding] Sample batches created.');
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed.ts')) {
  (async () => {
    try {
      await provisionAdministrators();
      await seedInitialBatches();
      await pool.end();
      process.exit(0);
    } catch (err: any) {
      console.error('[Provisioning Error]:', err.message);
      await pool.end();
      process.exit(1);
    }
  })();
}
