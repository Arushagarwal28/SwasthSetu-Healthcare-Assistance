import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    await Promise.all(validations.map((validation) => validation.run(req)));

    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }

    res.status(422).json({
      success: false,
      error: {
        message: 'Validation failed',
        details: errors.array().map((e) => ({
          field: e.type === 'field' ? e.path : undefined,
          message: e.msg,
        })),
      },
    });
  };
};