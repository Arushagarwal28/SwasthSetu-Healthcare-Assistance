/**
 * Full logical backup of the database this process connects to (DATABASE_URL).
 *
 * There is no pg_dump on this machine, so every Prisma model is exported to one
 * JSON file with row counts and a manifest. Use it before a destructive schema
 * migration; it is a data snapshot, not a replacement for migrations.
 *
 *   npx ts-node scripts/backup-db.ts
 *
 * The file is written to backups/ and contains personal data: never commit it.
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const delegateName = (model: string): string => model.charAt(0).toLowerCase() + model.slice(1);

const run = async (): Promise<void> => {
  const outDir = path.join(process.cwd(), 'backups');
  fs.mkdirSync(outDir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(outDir, `swasthsetu_db_backup_${stamp}.json`);

  const tables: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};

  for (const model of Prisma.dmmf.datamodel.models) {
    const delegate = (prisma as unknown as Record<string, { findMany: () => Promise<unknown[]> }>)[
      delegateName(model.name)
    ];
    if (!delegate) continue;
    const rows = await delegate.findMany();
    tables[model.name] = rows;
    counts[model.name] = rows.length;
  }

  const payload = {
    createdAt: new Date().toISOString(),
    source: 'DATABASE_URL',
    counts,
    tables,
  };

  fs.writeFileSync(file, JSON.stringify(payload), 'utf8');
  console.log(`Backup written: ${file}`);
  console.log(`Tables: ${Object.keys(counts).length}, rows: ${Object.values(counts).reduce((a, b) => a + b, 0)}`);
  for (const [name, n] of Object.entries(counts)) console.log(`  ${name}: ${n}`);
};

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
