import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { UIP_SCHEDULE, UIP_VACCINES } from '../src/modules/vaccination/uipSchedule.data';

const prisma = new PrismaClient();

// Create-if-missing only: re-running never overwrites a schedule an
// administrator has since edited.
async function main() {
  const vaccineIds = new Map<string, string>();

  for (const v of UIP_VACCINES) {
    const row = await prisma.vaccine.upsert({
      where: { code: v.code },
      update: {},
      create: v,
    });
    vaccineIds.set(v.code, row.id);
  }

  let order = 0;
  for (const entry of UIP_SCHEDULE) {
    const vaccineId = vaccineIds.get(entry.vaccineCode);
    if (!vaccineId) throw new Error(`Unknown vaccine code ${entry.vaccineCode}`);
    order += 1;

    const { vaccineCode: _vaccineCode, ...data } = entry;
    await prisma.vaccineScheduleEntry.upsert({
      where: { vaccineId_doseNumber: { vaccineId, doseNumber: entry.doseNumber } },
      update: {},
      create: { ...data, vaccineId, sortOrder: order },
    });
  }

  console.log(`Seeded ${UIP_VACCINES.length} vaccines and ${UIP_SCHEDULE.length} schedule entries.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
