import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axiosClient from '../../api/axiosClient';

export default function PatientProfilePage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('MALE');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    setError('');
    setIsLoading(true);

    try {
      await axiosClient.post('/patients/me', {
        fullName,
        dateOfBirth,
        gender,
        phone: phone || undefined,
        address: address || undefined,
      });

      navigate('/patient');
    } catch (error: any) {
      console.error('PROFILE CREATION ERROR:', error);

      const message =
        error.response?.data?.message ||
        error.response?.data?.errors?.[0]?.msg ||
        'Unable to create your profile. Please try again.';

      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
          <div className="mb-8">
            <p className="text-sm font-medium text-slate-500">
              Welcome to SwasthSetu
            </p>

            <h1 className="mt-2 text-2xl font-semibold text-slate-900">
              Complete your profile
            </h1>

            <p className="mt-2 text-sm text-slate-500">
              We need a few basic details before you can start an assessment.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="fullName"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Full name
              </label>

              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Enter your full name"
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label
                htmlFor="dateOfBirth"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Date of birth
              </label>

              <input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(event) => setDateOfBirth(event.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label
                htmlFor="gender"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Gender
              </label>

              <select
                id="gender"
                value={gender}
                onChange={(event) => setGender(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Phone number
              </label>

              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Optional"
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200"
              />
            </div>

            <div>
              <label
                htmlFor="address"
                className="block text-sm font-medium text-slate-700 mb-2"
              >
                Address
              </label>

              <textarea
                id="address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="Optional"
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-4 py-2.5 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200 resize-none"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Saving profile...' : 'Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}