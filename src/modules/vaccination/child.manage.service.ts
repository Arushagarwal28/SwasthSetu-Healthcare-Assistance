import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma';
import { AppError } from '../../middlewares/errorHandler';
import { childWriteAccessFilter } from './child.access';
import type { Actor } from './child.access';
import { getChildProfile } from './child.service';
import { cleanText } from './child.utils';

export interface UpdateChildBody {
  guardianName?: string | null;
  primaryMobile?: string;
  alternateMobile?: string | null;
  email?: string | null;
  addressLine?: string;
  village?: string;
  district?: string;
  state?: string;
  pinCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  preferredLanguage?: 'EN' | 'HI';
  smsConsent?: boolean;
}

const has = (body: object, key: string): boolean => Object.prototype.hasOwnProperty.call(body, key);

/**
 * Contact details and reminder preferences. The child's name, date of birth,
 * gender and JE flag are deliberately NOT editable here: they decide the dose
 * schedule, so a wrong one means registering the child again.
 */
export const updateChildDetails = async (actor: Actor, childId: string, body: UpdateChildBody) => {
  // D1: staff may edit personal/guardian details only for a child they
  // registered themselves AND while they still hold a valid grant. Another
  // staff member's grant never allows personal-data edits; helpers keep their
  // own-registration scope. See childWriteAccessFilter.

  const existing = await prisma.child.findFirst({
    where: { AND: [{ id: childId }, await childWriteAccessFilter(actor)] },
    select: { id: true, smsConsent: true },
  });
  if (!existing) throw new AppError('Child not found', 404);

  const data: Prisma.ChildUncheckedUpdateInput = {};

  if (has(body, 'guardianName')) data.guardianName = cleanText(body.guardianName);
  if (has(body, 'alternateMobile')) data.alternateMobile = cleanText(body.alternateMobile);
  if (has(body, 'email')) data.email = cleanText(body.email);

  if (has(body, 'primaryMobile')) {
    const v = cleanText(body.primaryMobile);
    if (!v) throw new AppError('Primary mobile cannot be empty', 400);
    data.primaryMobile = v;
  }
  const requiredText = (value: unknown, label: string): string => {
    const text = cleanText(value);
    if (!text) throw new AppError(`${label} cannot be empty`, 400);
    return text;
  };
  if (has(body, 'addressLine')) data.addressLine = requiredText(body.addressLine, 'addressLine');
  if (has(body, 'village')) data.village = requiredText(body.village, 'village');
  if (has(body, 'district')) data.district = requiredText(body.district, 'district');
  if (has(body, 'state')) data.state = requiredText(body.state, 'state');
  if (has(body, 'pinCode')) data.pinCode = requiredText(body.pinCode, 'pinCode');
  if (has(body, 'latitude') || has(body, 'longitude')) {
    data.latitude = body.latitude ?? null;
    data.longitude = body.longitude ?? null;
  }
  if (has(body, 'preferredLanguage') && body.preferredLanguage) data.preferredLanguage = body.preferredLanguage;

  // Consent changes are recorded with the time and the person who recorded them
  if (has(body, 'smsConsent') && typeof body.smsConsent === 'boolean' && body.smsConsent !== existing.smsConsent) {
    data.smsConsent = body.smsConsent;
    data.smsConsentAt = body.smsConsent ? new Date() : null;
    data.consentRecordedById = actor.userId;
  }

  if (Object.keys(data).length === 0) throw new AppError('Nothing to update', 400);

  await prisma.child.update({ where: { id: existing.id }, data });
  return getChildProfile(actor, childId);
};
