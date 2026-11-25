/**
 * Initial vaccination schedule: India's Universal Immunisation Programme (UIP),
 * child and adolescent doses only (the pregnant-mother Td row is out of scope).
 *
 * SOURCES (checked November 2026)
 *  - PIB Backgrounder "Celebrating the Power of Vaccines", Release ID 2241066,
 *    17 March 2026 — National Immunisation Schedule table (primary source).
 *  - National Health Mission / MoHFW "National Immunization Schedule" documents
 *    (nhm.gov.in) and the NHM Himachal Pradesh immunization page, for the
 *    "9-12 months", "16-24 months" windows and the endemic-district note on JE.
 *
 * Each dose is due at the START of its official age window (e.g. "9-12 months"
 * is due at 9 months); `ageLabel` keeps the official wording for display.
 *
 * DELIBERATELY NOT SEEDED (sources disagree or they are not routine UIP doses):
 *  - fIPV-3 at 9 months — appears in some NHM/state documents but not in the
 *    2026 PIB schedule table.
 *  - Vitamin A doses — a supplement, not a vaccine.
 *  - HPV for 14-year-old girls — launched as a nationwide campaign on
 *    28 Feb 2026 and is not in the PIB schedule table.
 *  An administrator can add any of these later (the HPV rule would use
 *  applicability FEMALE_ONLY) once your PHC/guide confirms them.
 *
 * Re-verify against the current official schedule before real-world use.
 */

export type AgeUnit = 'DAYS' | 'WEEKS' | 'MONTHS' | 'YEARS';
export type ApplicabilityRule = 'ALWAYS' | 'JE_ENDEMIC_DISTRICT' | 'FEMALE_ONLY';

export interface SeedVaccine {
  code: string;
  name: string;
  description: string;
}

export interface SeedScheduleEntry {
  vaccineCode: string;
  doseNumber: number;
  doseLabel: string;
  ageValue: number;
  ageUnit: AgeUnit;
  ageLabel: string;
  applicability: ApplicabilityRule;
  notes?: string;
}

export const UIP_VACCINES: SeedVaccine[] = [
  { code: 'BCG', name: 'BCG', description: 'Bacillus Calmette–Guérin; protects against severe forms of childhood tuberculosis.' },
  { code: 'OPV', name: 'Oral Polio Vaccine (bOPV)', description: 'Protects against polio.' },
  { code: 'HEPB', name: 'Hepatitis B (birth dose)', description: 'Birth dose protecting against hepatitis B.' },
  { code: 'PENTA', name: 'Pentavalent (DPT + Hep B + Hib)', description: 'Protects against diphtheria, pertussis, tetanus, hepatitis B and Hib.' },
  { code: 'RVV', name: 'Rotavirus Vaccine (RVV)', description: 'Protects against rotavirus diarrhoea.' },
  { code: 'FIPV', name: 'Fractional Inactivated Polio Vaccine (fIPV)', description: 'Injectable polio vaccine (fractional dose).' },
  { code: 'PCV', name: 'Pneumococcal Conjugate Vaccine (PCV)', description: 'Protects against pneumococcal disease.' },
  { code: 'MR', name: 'Measles–Rubella (MR)', description: 'Protects against measles and rubella.' },
  { code: 'JE', name: 'Japanese Encephalitis (JE)', description: 'Given only in JE-endemic districts.' },
  { code: 'DPT', name: 'DPT Booster', description: 'Booster against diphtheria, pertussis and tetanus.' },
  { code: 'TD', name: 'Td (Tetanus & adult Diphtheria)', description: 'Booster against tetanus and diphtheria.' },
];

const e = (
  vaccineCode: string,
  doseNumber: number,
  doseLabel: string,
  ageValue: number,
  ageUnit: AgeUnit,
  ageLabel: string,
  applicability: ApplicabilityRule = 'ALWAYS',
  notes?: string
): SeedScheduleEntry => ({
  vaccineCode,
  doseNumber,
  doseLabel,
  ageValue,
  ageUnit,
  ageLabel,
  applicability,
  ...(notes !== undefined ? { notes } : {}),
});

export const UIP_SCHEDULE: SeedScheduleEntry[] = [
  // Birth
  e('BCG', 1, 'BCG', 0, 'DAYS', 'At birth'),
  e('OPV', 1, 'OPV-0', 0, 'DAYS', 'At birth (within 15 days)'),
  e('HEPB', 1, 'Hepatitis B birth dose', 0, 'DAYS', 'At birth (within 24 hours)'),

  // 6 weeks
  e('OPV', 2, 'OPV-1', 6, 'WEEKS', '6 weeks'),
  e('PENTA', 1, 'Pentavalent-1', 6, 'WEEKS', '6 weeks'),
  e('RVV', 1, 'RVV-1', 6, 'WEEKS', '6 weeks'),
  e('FIPV', 1, 'fIPV-1', 6, 'WEEKS', '6 weeks'),
  e('PCV', 1, 'PCV-1', 6, 'WEEKS', '6 weeks'),

  // 10 weeks
  e('OPV', 3, 'OPV-2', 10, 'WEEKS', '10 weeks'),
  e('PENTA', 2, 'Pentavalent-2', 10, 'WEEKS', '10 weeks'),
  e('RVV', 2, 'RVV-2', 10, 'WEEKS', '10 weeks'),

  // 14 weeks
  e('OPV', 4, 'OPV-3', 14, 'WEEKS', '14 weeks'),
  e('PENTA', 3, 'Pentavalent-3', 14, 'WEEKS', '14 weeks'),
  e('FIPV', 2, 'fIPV-2', 14, 'WEEKS', '14 weeks'),
  e('RVV', 3, 'RVV-3', 14, 'WEEKS', '14 weeks'),
  e('PCV', 2, 'PCV-2', 14, 'WEEKS', '14 weeks'),

  // 9–12 months
  e('MR', 1, 'MR-1', 9, 'MONTHS', '9–12 months'),
  e('JE', 1, 'JE-1', 9, 'MONTHS', '9–12 months', 'JE_ENDEMIC_DISTRICT', 'Endemic districts only'),
  e('PCV', 3, 'PCV Booster', 9, 'MONTHS', '9–12 months'),

  // 16–24 months
  e('MR', 2, 'MR-2', 16, 'MONTHS', '16–24 months'),
  e('JE', 2, 'JE-2', 16, 'MONTHS', '16–24 months', 'JE_ENDEMIC_DISTRICT', 'Endemic districts only'),
  e('DPT', 1, 'DPT Booster-1', 16, 'MONTHS', '16–24 months'),
  e('OPV', 5, 'OPV Booster', 16, 'MONTHS', '16–24 months'),

  // School age and adolescence
  e('DPT', 2, 'DPT Booster-2', 5, 'YEARS', '5–6 years'),
  e('TD', 1, 'Td (10 years)', 10, 'YEARS', '10 years'),
  e('TD', 2, 'Td (16 years)', 16, 'YEARS', '16 years'),
];
