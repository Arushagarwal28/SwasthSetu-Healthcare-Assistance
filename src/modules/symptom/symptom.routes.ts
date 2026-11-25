import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.middleware';
import { getSymptoms } from './symptom.controller';

const router = Router();

router.get('/', authenticate, getSymptoms);

export default router;