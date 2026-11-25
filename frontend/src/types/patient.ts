export interface Patient {
  id: string;
  fullName: string;
  dateOfBirth: string;
  gender: 'MALE' | 'FEMALE' | 'OTHER';
  phone: string | null;
  email: string | null;
  address: string | null;
}