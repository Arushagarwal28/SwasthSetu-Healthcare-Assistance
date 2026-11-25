import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { formatRecordNumber } from './child.utils';

/** In-app notifications belong to one user and only that user can see or change them. */

export const listNotifications = async (userId: string, unreadOnly: boolean, page: number, limit: number) => {
  const where = { userId, ...(unreadOnly ? { readAt: null } : {}) };
  const [total, unread, rows] = await prisma.$transaction([
    prisma.vaccinationNotification.count({ where }),
    prisma.vaccinationNotification.count({ where: { userId, readAt: null } }),
    prisma.vaccinationNotification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: { child: { select: { id: true, fullName: true, recordNumber: true } } },
    }),
  ]);

  return {
    total,
    unread,
    page,
    limit,
    items: rows.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      readAt: n.readAt,
      createdAt: n.createdAt,
      doseId: n.doseId,
      child: {
        id: n.child.id,
        fullName: n.child.fullName,
        recordNumber: formatRecordNumber(n.child.recordNumber),
      },
    })),
  };
};

export const unreadCount = async (userId: string): Promise<number> =>
  prisma.vaccinationNotification.count({ where: { userId, readAt: null } });

export const markNotificationRead = async (userId: string, id: string): Promise<void> => {
  const changed = await prisma.vaccinationNotification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
  if (changed.count === 0) {
    // Either it does not exist / is not yours (404), or it was already read (fine)
    const exists = await prisma.vaccinationNotification.findFirst({ where: { id, userId }, select: { id: true } });
    if (!exists) throw new AppError('Notification not found', 404);
  }
};

export const markAllNotificationsRead = async (userId: string): Promise<number> => {
  const changed = await prisma.vaccinationNotification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return changed.count;
};
