import { body } from 'express-validator';
import { isValidYmd } from './vaccination.dates';


export const verifyChildAccessValidation = [
  body('recordNumber')
    .exists()
    .withMessage('Vaccination record number is required')
    .bail()
    .isString()
    .withMessage('Vaccination record number is required')
    .trim()
    .notEmpty()
    .withMessage('Vaccination record number is required')
    .isLength({ max: 32 })
    .withMessage('Vaccination record number is too long'),

  body('guardianMobile')
    .exists()
    .withMessage("Registered guardian's mobile number is required")
    .bail()
    .isString()
    .withMessage("Registered guardian's mobile number is required")
    .trim()
    .notEmpty()
    .withMessage("Registered guardian's mobile number is required")
    .isLength({ max: 20 })
    .withMessage("Registered guardian's mobile number is too long"),

  body('dateOfBirth')
    .exists()
    .withMessage("Child's date of birth is required")
    .bail()
    .custom((value) => isValidYmd(String(value)))
    .withMessage('Date of birth must be a real date in YYYY-MM-DD format'),

  // Required only when the staff member is linked to several active facilities.
  // The service accepts an omission when exactly one facility can be used.
  body('facilityId')
    .optional({ values: 'falsy' })
    .isUUID()
    .withMessage('facilityId must be a valid id'),

  body('guardianConsentConfirmed')
    .exists()
    .withMessage('Confirm that guardian permission was obtained')
    .bail()
    .isBoolean()
    .withMessage('Confirm that guardian permission was obtained')
    .toBoolean()
    .custom((value) => value === true)
    .withMessage('Confirm that guardian permission was obtained'),
];
