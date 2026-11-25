import bcrypt from 'bcrypt';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '../../utils/jwt';
import { assertRegistrationAllowed } from './registration.policy';

const SALT_ROUNDS = 10;
const REFRESH_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches JWT_REFRESH_EXPIRES_IN

export const registerUser = async (
  email: string,
  password: string,
  role: string,
  referenceCode?: string,
  fullName?: string,
  phone?: string
) => {
  // Check role-specific registration permissions before accessing the database.
  assertRegistrationAllowed(role, referenceCode);

  // Validate Helper fields before creating the user, avoiding orphan accounts.
  if (role === 'HELPER' && (!fullName?.trim() || !phone?.trim())) {
    throw new AppError('Full name and phone are required for Helper registration', 400);
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new AppError('Email already registered', 409);
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  // Create the user and Helper profile atomically.
  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { email, passwordHash, role: role as any },
      select: { id: true, email: true, role: true, createdAt: true },
    });

    if (role === 'HELPER') {
      await tx.helperProfile.create({
        data: {
          userId: user.id,
          fullName: fullName!.trim(),
          phone: phone!.trim(),
        },
      });
    }

    return user;
  });
};

export const loginUser = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) {
    throw new AppError('Invalid credentials', 401);
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new AppError('Invalid credentials', 401);
  }

  const accessToken = signAccessToken({ userId: user.id, role: user.role });
  const refreshToken = signRefreshToken({ userId: user.id, role: user.role });

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + REFRESH_EXPIRY_MS),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: { id: user.id, email: user.email, role: user.role },
  };
};

export const refreshAccessToken = async (token: string) => {
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const stored = await prisma.refreshToken.findUnique({ where: { token } });
  if (!stored || stored.expiresAt < new Date()) {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  const accessToken = signAccessToken({ userId: payload.userId, role: payload.role });
  return { accessToken };
};

export const logoutUser = async (token: string) => {
  await prisma.refreshToken.deleteMany({ where: { token } });
};

export const getCurrentUser = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, role: true, createdAt: true },
  });
  if (!user) throw new AppError('User not found', 404);
  return user;
};
