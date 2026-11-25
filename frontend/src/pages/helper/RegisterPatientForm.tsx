import { useState } from 'react';

import { registerPatientByHelper } from '../../api/helpers';
import { type Patient } from '../../types/patient';
import Button from '../../components/ui/Button';

interface Props {
  onSuccess: (patient: Patient) => void;
  onCancel: () => void;
}

const MOBILE_REGEX = /^[6-9]\d{9}$/;

export default function RegisterPatientForm({
  onSuccess,
  onCancel,
}: Props) {
  const [form, setForm] = useState({
    fullName: '',
    dateOfBirth: '',
    gender: 'MALE',
    phone: '',
    email: '',
    address: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [apiError, setApiError] = useState('');

  const validate = () => {
    const e: Record<string, string> = {};

    if (!form.fullName.trim()) {
      e.fullName = 'Full name is required';
    }

    if (!form.dateOfBirth) {
      e.dateOfBirth = 'Date of birth is required';
    } else if (new Date(form.dateOfBirth) > new Date()) {
      e.dateOfBirth = 'Date of birth cannot be in the future';
    }

    if (!MOBILE_REGEX.test(form.phone)) {
      e.phone =
        'Enter a valid 10-digit mobile number starting with 6-9';
    }

    if (
      form.email &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
    ) {
      e.email = 'Enter a valid email';
    }

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setSubmitting(true);
    setApiError('');

    try {
      const patient = await registerPatientByHelper({
        fullName: form.fullName.trim(),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender,
        phone: form.phone,
        email: form.email || undefined,
        address: form.address || undefined,
      });

      onSuccess(patient);
    } catch (err: any) {
      setApiError(
        err?.response?.data?.error?.message ||
          'Could not register patient. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const field = (
    key: keyof typeof form,
    label: string,
    type = 'text',
  ) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>

      {key === 'gender' ? (
        <select
          value={form.gender}
          onChange={(e) =>
            setForm({
              ...form,
              gender: e.target.value,
            })
          }
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="MALE">Male</option>
          <option value="FEMALE">Female</option>
          <option value="OTHER">Other</option>
        </select>
      ) : (
        <input
          type={type}
          value={form[key]}
          onChange={(e) =>
            setForm({
              ...form,
              [key]: e.target.value,
            })
          }
          className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      )}

      {errors[key] && (
        <p className="text-xs text-red-600 mt-1">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5 max-w-md w-full">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">
        Register New Patient
      </h2>

      {field('fullName', 'Full Name')}
      {field('dateOfBirth', 'Date of Birth', 'date')}
      {field('gender', 'Gender')}
      {field('phone', 'Mobile Number', 'tel')}
      {field('email', 'Email (optional)', 'email')}
      {field('address', 'Address (optional)')}

      {apiError && (
        <p className="text-sm text-red-600 mb-3">
          {apiError}
        </p>
      )}

      <div className="flex justify-end gap-3 mt-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          Cancel
        </button>

        <Button
          type="button"
          onClick={handleSubmit}
          loading={submitting}
          loadingText="Registering…"
        >
          Register Patient
        </Button>
      </div>
    </div>
  );
}