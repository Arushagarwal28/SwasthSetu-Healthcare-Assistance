import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler';
import { body } from 'express-validator';
import { validate } from './middlewares/validate';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';
import { i18nMiddleware } from './config/i18n';
import authRoutes from './modules/auth/auth.routes';
import patientRoutes from './modules/patients/patient.routes';
import facilityRoutes from './modules/facilities/facility.routes';
import helperRoutes from './modules/helpers/helper.routes';
import assessmentRoutes from './modules/assessments/assessment.routes';
import symptomRoutes from './modules/symptom/symptom.routes';
import referralRoutes from './modules/referrals/referral.routes';
import childRoutes from './modules/vaccination/child.routes';
import vaccinationRoutes from './modules/vaccination/vaccination.routes';
import reportRoutes from './modules/reports/report.routes';
const app = express();

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(i18nMiddleware);
app.use('/api/v1/auth', authRoutes);
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api/v1/patients', patientRoutes);
app.use('/api/v1/facilities', facilityRoutes);
app.use('/api/v1/helpers', helperRoutes);
app.use('/api/v1/assessments', assessmentRoutes);
app.use('/api/v1/symptoms', symptomRoutes);
app.use('/api/v1/referrals', referralRoutes);
app.use('/api/v1/children', childRoutes);
app.use('/api/v1/vaccination', vaccinationRoutes);
app.use('/api/v1/reports', reportRoutes);
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     responses:
 *       200:
 *         description: Server is running
 */
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: req.t('health.ok'),
    timestamp: new Date().toISOString(),
  });
});

app.post(
  '/api/v1/test-validate',
  validate([
    body('email').isEmail().withMessage('Valid email is required'),
    body('age').isInt({ min: 1 }).withMessage('Age must be a positive integer'),
  ]),
  (req, res) => {
    res.status(200).json({ success: true, data: req.body });
  }
);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;