import { prisma } from '../../config/prisma';

export const getAllSymptoms = async () => {
  return prisma.symptom.findMany({
    orderBy: {
      name: 'asc',
    },
    select: {
      id: true,
      key: true,
      name: true,
      category: true,
    },
  });
};