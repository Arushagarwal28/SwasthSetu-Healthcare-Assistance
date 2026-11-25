import rateLimit from 'express-rate-limit';

// Registration is where reference codes can be guessed, so it is rate-limited.
// In-memory and per IP — enough for this project; a shared store (Redis) would
// be needed to enforce it across several server instances.
export const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.REGISTER_RATE_LIMIT) || 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: { message: 'Too many registration attempts. Please try again later.' },
    });
  },
});