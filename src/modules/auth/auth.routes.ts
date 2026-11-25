import { Router } from 'express';
import { register, login, refresh, logout, me } from './auth.controller';
import { validate } from '../../middlewares/validate';
import { registerValidation, loginValidation } from './auth.validation';
import { authenticate } from '../../middlewares/auth.middleware';
import { registerLimiter } from '../../middlewares/rateLimiters';

const router = Router();

router.post('/register', registerLimiter, validate(registerValidation), register);
router.post('/login', validate(loginValidation), login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authenticate, me);

export default router;
