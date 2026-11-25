import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axiosClient from '../api/axiosClient';
import Button from '../components/ui/Button';

type RegisterRole = 'PATIENT' | 'HELPER' | 'HOSPITAL_STAFF';

interface RegisterResponse {
  success: boolean;
  data: {
    id: string;
    email: string;
    role: RegisterRole;
    createdAt: string;
  };
}

const MOBILE_REGEX = /^[6-9]\d{9}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ROLE_OPTIONS: {
  value: RegisterRole;
  title: string;
  description: string;
}[] = [
  {
    value: 'PATIENT',
    title: 'Patient',
    description: 'Check symptoms and access healthcare support.',
  },
  {
    value: 'HELPER',
    title: 'Helper',
    description: 'Assist patients as an authorized health worker.',
  },
  {
    value: 'HOSPITAL_STAFF',
    title: 'Hospital Staff',
    description: 'Manage incoming referrals for your facility.',
  },
];

const CODE_LABEL: Record<Exclude<RegisterRole, 'PATIENT'>, string> = {
  HELPER: 'PHC Reference Code',
  HOSPITAL_STAFF: 'Hospital Reference Code',
};

const CODE_PLACEHOLDER: Record<Exclude<RegisterRole, 'PATIENT'>, string> = {
  HELPER: 'Provided by your PHC',
  HOSPITAL_STAFF: 'Provided by your hospital administrator',
};

export default function RegisterPage() {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState<RegisterRole>('PATIENT');
  const [referenceCode, setReferenceCode] = useState('');

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleRoleChange = (newRole: RegisterRole) => {
    setRole(newRole);
    setReferenceCode('');
    setErrors({});
    setApiError('');
    setSuccess('');

    if (newRole !== 'HELPER') {
      // These fields are Helper-specific and are not submitted for other roles.
      setFullName('');
      setPhone('');
    }
  };

  const validate = () => {
    const validationErrors: Record<string, string> = {};

    if (!email.trim()) {
      validationErrors.email = 'Email is required.';
    } else if (!EMAIL_REGEX.test(email.trim())) {
      validationErrors.email = 'Enter a valid email address.';
    }

    if (!password) {
      validationErrors.password = 'Password is required.';
    } else if (password.length < 8) {
      validationErrors.password = 'Password must be at least 8 characters.';
    }

    if (!confirmPassword) {
      validationErrors.confirmPassword = 'Please confirm your password.';
    } else if (confirmPassword !== password) {
      validationErrors.confirmPassword = 'Passwords do not match.';
    }

    if (role === 'HELPER') {
      if (!fullName.trim()) {
        validationErrors.fullName = 'Full name is required.';
      }
      if (!MOBILE_REGEX.test(phone)) {
        validationErrors.phone = 'Enter a valid 10-digit Indian mobile number.';
      }
    }

    if (role !== 'PATIENT' && !referenceCode.trim()) {
      validationErrors.referenceCode = `${CODE_LABEL[role]} is required.`;
    }

    setErrors(validationErrors);
    return Object.keys(validationErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrors({});
    setApiError('');
    setSuccess('');

    if (!validate()) return;

    setIsLoading(true);

    try {
      await axiosClient.post<RegisterResponse>('/auth/register', {
        email: email.trim(),
        password,
        role,
        ...(role !== 'PATIENT' ? { referenceCode: referenceCode.trim() } : {}),
        ...(role === 'HELPER'
          ? { fullName: fullName.trim(), phone }
          : {}),
      });

      setSuccess('Registration successful. Redirecting to login...');
      window.setTimeout(() => {
        navigate('/login', { replace: true });
      }, 1000);
    } catch (error: any) {
      console.error('REGISTRATION ERROR:', error);
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        error?.response?.data?.errors?.[0]?.msg ||
        'Registration failed. Please try again.';
      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 px-4 py-8 sm:py-10">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 md:grid md:grid-cols-2">
          {/* Left branding panel retained from the existing registration page. */}
          <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-700 p-10 text-white md:flex md:flex-col md:justify-between lg:p-12">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10" />
            <div className="absolute -bottom-28 -left-24 h-80 w-80 rounded-full bg-white/10" />

            <div className="relative z-10">
              <Link to="/" className="inline-flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl font-bold ring-1 ring-white/20">
                  S
                </div>
                <span className="text-2xl font-bold tracking-tight">SwasthSetu</span>
              </Link>
            </div>

            <div className="relative z-10 my-12">
              <p className="mb-3 text-sm font-medium uppercase tracking-wider text-blue-100">
                Join SwasthSetu
              </p>
              <h2 className="text-3xl font-bold leading-tight lg:text-4xl">
                Connecting people<br />to better healthcare.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-6 text-blue-100">
                Create an account to access healthcare support, symptom assessment, and connected services.
              </p>
              <div className="mt-8 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs">✓</div>
                  <div>
                    <p className="text-sm font-medium text-white">Accessible healthcare</p>
                    <p className="mt-0.5 text-xs text-blue-100">Designed to make healthcare support easier to access.</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-xs">✓</div>
                  <div>
                    <p className="text-sm font-medium text-white">Connected support</p>
                    <p className="mt-0.5 text-xs text-blue-100">Patients and healthcare helpers can stay connected.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-3 text-sm text-blue-100">
                <div className="h-2 w-2 rounded-full bg-emerald-300" />
                SwasthSetu healthcare platform
              </div>
            </div>
          </div>

          {/* Registration form */}
          <div className="p-6 sm:p-9 lg:p-11">
            <div className="mb-7 flex items-center justify-center gap-3 md:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white shadow-sm">S</div>
              <span className="text-2xl font-bold text-slate-900">SwasthSetu</span>
            </div>

            <div className="mb-7">
              <p className="mb-2 text-sm font-medium text-blue-600">Get started</p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900">Create your account</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                Choose your role and enter your details to join SwasthSetu.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <fieldset>
                <legend className="mb-2.5 block text-sm font-medium text-slate-700">
                  I am registering as
                </legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {ROLE_OPTIONS.map((option) => {
                    const selected = role === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => handleRoleChange(option.value)}
                        aria-pressed={selected}
                        className={`rounded-xl border p-3 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
                          selected
                            ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600'
                            : 'border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-semibold ${selected ? 'text-blue-700' : 'text-slate-800'}`}>
                            {option.title}
                          </span>
                          <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${selected ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300'}`}>
                            {selected && <span className="text-xs">✓</span>}
                          </span>
                        </div>
                        <p className="mt-1.5 text-xs leading-5 text-slate-500">{option.description}</p>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Helper-only profile fields retained from the existing page. */}
              {role === 'HELPER' && (
                <div className="space-y-5 rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                  <div>
                    <label htmlFor="fullName" className="mb-2 block text-sm font-medium text-slate-700">Full name</label>
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(event) => {
                        setFullName(event.target.value);
                        setErrors((prev) => ({ ...prev, fullName: '' }));
                      }}
                      placeholder="Enter your full name"
                      autoComplete="name"
                      className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${errors.fullName ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100' : 'border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'}`}
                    />
                    {errors.fullName && <p className="mt-1.5 text-xs text-red-600">{errors.fullName}</p>}
                  </div>
                  <div>
                    <label htmlFor="phone" className="mb-2 block text-sm font-medium text-slate-700">Mobile number</label>
                    <input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={(event) => {
                        setPhone(event.target.value.replace(/\D/g, '').slice(0, 10));
                        setErrors((prev) => ({ ...prev, phone: '' }));
                      }}
                      placeholder="10-digit mobile number"
                      autoComplete="tel"
                      maxLength={10}
                      className={`w-full rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${errors.phone ? 'border-red-400 focus:border-red-500 focus:ring-4 focus:ring-red-100' : 'border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100'}`}
                    />
                    {errors.phone && <p className="mt-1.5 text-xs text-red-600">{errors.phone}</p>}
                  </div>
                </div>
              )}

              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">Email address</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setErrors((prev) => ({ ...prev, email: '' }));
                    setApiError('');
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={`w-full rounded-xl border px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${errors.email ? 'border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-4 focus:ring-red-100' : 'border-slate-300 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100'}`}
                />
                {errors.email && <p className="mt-1.5 text-xs text-red-600">{errors.email}</p>}
              </div>

              <div>
                <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">Password</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setErrors((prev) => ({ ...prev, password: '' }));
                  }}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  className={`w-full rounded-xl border px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${errors.password ? 'border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-4 focus:ring-red-100' : 'border-slate-300 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100'}`}
                />
                {errors.password && <p className="mt-1.5 text-xs text-red-600">{errors.password}</p>}
              </div>

              <div>
                <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-700">Confirm password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value);
                    setErrors((prev) => ({ ...prev, confirmPassword: '' }));
                  }}
                  placeholder="Re-enter your password"
                  autoComplete="new-password"
                  className={`w-full rounded-xl border px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${errors.confirmPassword ? 'border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-4 focus:ring-red-100' : 'border-slate-300 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100'}`}
                />
                {errors.confirmPassword && <p className="mt-1.5 text-xs text-red-600">{errors.confirmPassword}</p>}
              </div>

              {/* Both non-patient roles require their role-specific reference code. */}
              {role !== 'PATIENT' && (
                <div>
                  <label htmlFor="referenceCode" className="mb-2 block text-sm font-medium text-slate-700">
                    {CODE_LABEL[role]}
                  </label>
                  <input
                    id="referenceCode"
                    type="text"
                    value={referenceCode}
                    onChange={(event) => {
                      setReferenceCode(event.target.value);
                      setErrors((prev) => ({ ...prev, referenceCode: '' }));
                      setApiError('');
                    }}
                    placeholder={CODE_PLACEHOLDER[role]}
                    autoComplete="off"
                    className={`w-full rounded-xl border px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${errors.referenceCode ? 'border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-4 focus:ring-red-100' : 'border-slate-300 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100'}`}
                  />
                  <p className="mt-1.5 text-xs text-slate-500">
                    {role === 'HELPER'
                      ? 'Enter the reference code provided by your authorized PHC.'
                      : 'Enter the reference code provided by your hospital administrator.'}
                  </p>
                  {errors.referenceCode && <p className="mt-1.5 text-xs text-red-600">{errors.referenceCode}</p>}
                </div>
              )}

              {apiError && (
                <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">!</div>
                  <p className="text-sm leading-5 text-red-700">{apiError}</p>
                </div>
              )}

              {success && (
                <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-600">✓</div>
                  <p className="text-sm leading-5 text-emerald-700">{success}</p>
                </div>
              )}

              <Button
                type="submit"
                loading={isLoading}
                loadingText="Creating account…"
                className="w-full rounded-xl !py-3 text-sm font-semibold shadow-sm"
              >
                Create Account
              </Button>
            </form>

            <div className="mt-7 border-t border-slate-100 pt-6 text-center">
              <p className="text-sm text-slate-500">
                Already have an account?{' '}
                <Link to="/login" className="font-semibold text-blue-600 transition hover:text-blue-700 hover:underline">
                  Sign in
                </Link>
              </p>
            </div>

            <p className="mt-6 text-center text-xs text-slate-400">
              Your account information is used to provide access to the SwasthSetu platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
