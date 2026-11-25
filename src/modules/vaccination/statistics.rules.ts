/**
 * Small pure helpers for the statistics screens. Tested in statistics.rules.test.ts.
 */

/**
 * Of the doses whose due date has arrived (or that were already given), the
 * share that has been given. Doses that are not due yet are left out so a new
 * baby does not drag coverage down.
 */
export const coveragePercent = (administered: number, notGiven: number, pastDueOpen: number): number => {
  const denominator = administered + notGiven + pastDueOpen;
  return denominator === 0 ? 0 : Math.round((administered / denominator) * 1000) / 10;
};

export interface VaccineStatusCount {
  vaccineCode: string;
  recordedStatus: string;
  count: number;
}

export interface VaccineCoverageRow {
  vaccineCode: string;
  administered: number;
  notGiven: number;
  overdue: number;
  coveragePercent: number;
}

/** Combine "doses by vaccine and recorded status" with "past-due open doses by vaccine". */
export const buildVaccineCoverage = (
  byStatus: VaccineStatusCount[],
  pastDueOpenByVaccine: { vaccineCode: string; count: number }[]
): VaccineCoverageRow[] => {
  const codes = new Set<string>([...byStatus.map((r) => r.vaccineCode), ...pastDueOpenByVaccine.map((r) => r.vaccineCode)]);
  const sum = (code: string, status: string) =>
    byStatus.filter((r) => r.vaccineCode === code && r.recordedStatus === status).reduce((n, r) => n + r.count, 0);

  return [...codes]
    .sort()
    .map((code) => {
      const administered = sum(code, 'ADMINISTERED');
      const notGiven = sum(code, 'NOT_GIVEN');
      const overdue = pastDueOpenByVaccine.filter((r) => r.vaccineCode === code).reduce((n, r) => n + r.count, 0);
      return { vaccineCode: code, administered, notGiven, overdue, coveragePercent: coveragePercent(administered, notGiven, overdue) };
    });
};
