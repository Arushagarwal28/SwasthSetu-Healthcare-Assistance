import { Request, Response, NextFunction } from 'express';
import { registerUser, loginUser, refreshAccessToken, logoutUser, getCurrentUser } from './auth.service';
import { AuthRequest } from '../../middlewares/auth.middleware';

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, role, fullName, phone } = req.body;

    // Keep phcReferenceCode temporarily for compatibility with older clients.
    const referenceCode = req.body.referenceCode ?? req.body.phcReferenceCode;

    const user = await registerUser(
      email,
      password,
      role,
      referenceCode,
      fullName,
      phone
    );

    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    const result = await loginUser(email, password);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    const result = await refreshAccessToken(refreshToken);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;
    await logoutUser(refreshToken);
    res.status(200).json({ success: true, data: { message: 'Logged out successfully' } });
  } catch (err) {
    next(err);
  }
};

export const me = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await getCurrentUser(req.user!.userId);
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};
