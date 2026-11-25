import type { Server as HttpServer } from 'http';
import { Server } from 'socket.io';
import { prisma } from '../config/prisma';
import { verifyAccessToken } from '../utils/jwt';
import type { JwtPayload } from '../utils/jwt';

let io: Server | null = null;

const userRoom = (userId: string) => `user:${userId}`;
const facilityRoom = (facilityId: string) => `facility:${facilityId}`;

export const initSocket = (httpServer: HttpServer): Server => {
  const origins = (process.env.FRONTEND_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim());

  io = new Server(httpServer, { cors: { origin: origins } });

  // Same JWT as the REST API, sent in the handshake.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (typeof token !== 'string' || !token) {
      return next(new Error('Authentication token required'));
    }
    try {
      socket.data.user = verifyAccessToken(token);
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', async (socket) => {
    const user = socket.data.user as JwtPayload;

    // Everyone gets a private room; staff also join one room per linked facility.
    socket.join(userRoom(user.userId));

    if (user.role === 'HOSPITAL_STAFF') {
      try {
        const links = await prisma.hospitalStaffFacilityLink.findMany({
          where: { userId: user.userId },
          select: { facilityId: true },
        });
        links.forEach((l) => socket.join(facilityRoom(l.facilityId)));
      } catch (err) {
        console.error('SOCKET ROOM JOIN ERROR:', err);
      }
    }
  });

  return io;
};

export interface ReferralNotifyInput {
  id: string;
  assessmentId: string;
  status: string;
  createdById: string;
  patientId: string;
  destinationFacilityId: string;
}

/**
 * Tells the interested parties that a referral changed. The payload carries
 * ids and status only (no patient data); clients refetch through the REST API,
 * which enforces access control. A failure here never affects the request.
 */
export const notifyReferralChange = async (
  referral: ReferralNotifyInput,
  kind: 'created' | 'updated'
): Promise<void> => {
  if (!io) return;
  try {
    const rooms = new Set<string>([
      facilityRoom(referral.destinationFacilityId),
      userRoom(referral.createdById),
    ]);

    const patient = await prisma.patient.findUnique({
      where: { id: referral.patientId },
      select: { userId: true },
    });
    if (patient?.userId) rooms.add(userRoom(patient.userId));

    io.to(Array.from(rooms)).emit('referral:changed', {
      kind,
      referralId: referral.id,
      assessmentId: referral.assessmentId,
      status: referral.status,
    });
  } catch (err) {
    console.error('SOCKET NOTIFY ERROR:', err);
  }
};