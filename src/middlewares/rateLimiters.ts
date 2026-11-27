import rateLimit from 'express-rate-limit';

// Registration is where reference codes can be guessed, so it is rate-limited.
// In-memory and per IP — enough for this project; a shared store (Redis) would
// be needed to enforce it across several server instances.
/**
 * Cross-facility child verification is brute-force sensitive: the vaccination
 * record number is sequential and the other two fields are guessable, so every
 * attempt (success or failure) is counted per authenticated account.
 */
export const childVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: Number(process.env.CHILD_VERIFY_RATE_LIMIT) || 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  keyGenerator: (req) =>
    `user:${(req as unknown as { user?: { userId?: string } }).user?.userId ?? 'anonymous'}`,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: { message: 'Too many verification attempts. Please try again later.' },
    });
  },
});

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