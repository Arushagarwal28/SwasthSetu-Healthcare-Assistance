import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const diseaseInfo: { diseaseName: string; urgency: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL'; requiredSpecialty: string }[] = [
  { diseaseName: '(vertigo) Paroymsal  Positional Vertigo', urgency: 'MODERATE', requiredSpecialty: 'Neurology' },
  { diseaseName: 'AIDS', urgency: 'HIGH', requiredSpecialty: 'General Medicine' },
  { diseaseName: 'Acne', urgency: 'LOW', requiredSpecialty: 'Dermatology' },
  { diseaseName: 'Alcoholic hepatitis', urgency: 'HIGH', requiredSpecialty: 'Gastroenterology' },
  { diseaseName: 'Allergy', urgency: 'LOW', requiredSpecialty: 'General Medicine' },
  { diseaseName: 'Arthritis', urgency: 'LOW', requiredSpecialty: 'Orthopedics' },
  { diseaseName: 'Bronchial Asthma', urgency: 'MODERATE', requiredSpecialty: 'Pulmonology' },
  { diseaseName: 'Cervical spondylosis', urgency: 'LOW', requiredSpecialty: 'Orthopedics' },
  { diseaseName: 'Chicken pox', urgency: 'MODERATE', requiredSpecialty: 'General Medicine' },
  { diseaseName: 'Chronic cholestasis', urgency: 'HIGH', requiredSpecialty: 'Gastroenterology' },
  { diseaseName: 'Common Cold', urgency: 'LOW', requiredSpecialty: 'General Medicine' },
  { diseaseName: 'Dengue', urgency: 'HIGH', requiredSpecialty: 'General Medicine' },
  { diseaseName: 'Diabetes', urgency: 'MODERATE', requiredSpecialty: 'Endocrinology' },
  { diseaseName: 'Dimorphic hemmorhoids(piles)', urgency: 'LOW', requiredSpecialty: 'General Surgery' },
  { diseaseName: 'Drug Reaction', urgency: 'HIGH', requiredSpecialty: 'General Medicine' },
  { diseaseName: 'Fungal infection', urgency: 'LOW', requiredSpecialty: 'Dermatology' },
  { diseaseName: 'GERD', urgency: 'LOW', requiredSpecialty: 'Gastroenterology' },
  { diseaseName: 'Gastroenteritis', urgency: 'MODERATE', requiredSpecialty: 'Gastroenterology' },
  { diseaseName: 'Heart attack', urgency: 'CRITICAL', requiredSpecialty: 'Cardiology' },
  { diseaseName: 'Hepatitis B', urgency: 'HIGH', requiredSpecialty: 'Gastroenterology' },
  { diseaseName: 'Hepatitis C', urgency: 'HIGH', requiredSpecialty: 'Gastroenterology' },
  { diseaseName: 'Hepatitis D', urgency: 'HIGH', requiredSpecialty: 'Gastroenterology' },
  { diseaseName: 'Hepatitis E', urgency: 'HIGH', requiredSpecialty: 'Gastroenterology' },
  { diseaseName: 'Hypertension', urgency: 'MODERATE', requiredSpecialty: 'Cardiology' },
  { diseaseName: 'Hyperthyroidism', urgency: 'MODERATE', requiredSpecialty: 'Endocrinology' },
  { diseaseName: 'Hypoglycemia', urgency: 'HIGH', requiredSpecialty: 'Endocrinology' },
  { diseaseName: 'Hypothyroidism', urgency: 'MODERATE', requiredSpecialty: 'Endocrinology' },
  { diseaseName: 'Impetigo', urgency: 'LOW', requiredSpecialty: 'Dermatology' },
  { diseaseName: 'Jaundice', urgency: 'HIGH', requiredSpecialty: 'Gastroenterology' },
  { diseaseName: 'Malaria', urgency: 'HIGH', requiredSpecialty: 'General Medicine' },
  { diseaseName: 'Migraine', urgency: 'LOW', requiredSpecialty: 'Neurology' },
  { diseaseName: 'Osteoarthristis', urgency: 'LOW', requiredSpecialty: 'Orthopedics' },
  { diseaseName: 'Paralysis (brain hemorrhage)', urgency: 'CRITICAL', requiredSpecialty: 'Neurology' },
  { diseaseName: 'Peptic ulcer diseae', urgency: 'MODERATE', requiredSpecialty: 'Gastroenterology' },
  { diseaseName: 'Pneumonia', urgency: 'HIGH', requiredSpecialty: 'Pulmonology' },
  { diseaseName: 'Psoriasis', urgency: 'LOW', requiredSpecialty: 'Dermatology' },
  { diseaseName: 'Tuberculosis', urgency: 'HIGH', requiredSpecialty: 'Pulmonology' },
  { diseaseName: 'Typhoid', urgency: 'HIGH', requiredSpecialty: 'General Medicine' },
  { diseaseName: 'Urinary tract infection', urgency: 'MODERATE', requiredSpecialty: 'Urology' },
  { diseaseName: 'Varicose veins', urgency: 'LOW', requiredSpecialty: 'General Surgery' },
  { diseaseName: 'hepatitis A', urgency: 'HIGH', requiredSpecialty: 'Gastroenterology' },
];

async function main() {
  for (const info of diseaseInfo) {
    await prisma.diseaseInfo.upsert({
      where: { diseaseName: info.diseaseName },
      update: { urgency: info.urgency, requiredSpecialty: info.requiredSpecialty },
      create: info,
    });
  }
  console.log(`Seeded ${diseaseInfo.length} disease info records`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
