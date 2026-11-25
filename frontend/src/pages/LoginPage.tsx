import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import axiosClient from '../api/axiosClient';
import { useAuth } from '../auth/AuthContext';
import Button from '../components/ui/Button';

interface LoginResponse {
  success: boolean;
  data: {
    accessToken: string;
    refreshToken: string;
    user: {
      id: string;
      email: string;
      role: 'PATIENT' | 'HELPER' | 'HOSPITAL_STAFF' | 'ADMIN';
    };
  };
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const validate = () => {
    const validationErrors: Record<string, string> = {};

    if (!email.trim()) {
      validationErrors.email = 'Email is required.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      validationErrors.email = 'Enter a valid email address.';
    }

    if (!password) {
      validationErrors.password = 'Password is required.';
    }

    setErrors(validationErrors);

    return Object.keys(validationErrors).length === 0;
  };

  const handleSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    setApiError('');

    if (!validate()) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await axiosClient.post<LoginResponse>(
        '/auth/login',
        {
          email: email.trim(),
          password,
        },
      );

      const { accessToken, refreshToken, user } =
        response.data.data;

      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);

      setUser(user);

      switch (user.role) {
        case 'PATIENT':
          navigate('/patient', { replace: true });
          break;

        case 'HELPER':
          navigate('/helper', { replace: true });
          break;

        case 'HOSPITAL_STAFF':
          navigate('/hospital', { replace: true });
          break;

        case 'ADMIN':
          navigate('/admin', { replace: true });
          break;

        default:
          setApiError('Unknown user role.');
      }
    } catch (error: any) {
      console.error('LOGIN ERROR:', error);

      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error?.message ||
        'Invalid email or password. Please try again.';

      setApiError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-200/50 md:grid md:grid-cols-2">

          {/* Left side */}
          <div className="relative hidden overflow-hidden bg-gradient-to-br from-blue-600 via-blue-700 to-cyan-700 p-10 text-white md:flex md:flex-col md:justify-between">
            
            {/* Decorative circles */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10" />
            <div className="absolute -bottom-24 -left-20 h-72 w-72 rounded-full bg-white/10" />

            <div className="relative z-10">
              <Link
                to="/"
                className="inline-flex items-center gap-3"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-xl font-bold ring-1 ring-white/20">
                  S
                </div>

                <span className="text-2xl font-bold tracking-tight">
                  SwasthSetu
                </span>
              </Link>
            </div>

            <div className="relative z-10 my-12">
              <p className="mb-3 text-sm font-medium uppercase tracking-wider text-blue-100">
                Accessible Healthcare
              </p>

              <h2 className="text-3xl font-bold leading-tight lg:text-4xl">
                Healthcare support,
                <br />
                connected for everyone.
              </h2>

              <p className="mt-5 max-w-md text-sm leading-6 text-blue-100">
                Access symptom assessment, healthcare assistance,
                and connected medical services through SwasthSetu.
              </p>
            </div>

            <div className="relative z-10">
              <div className="flex items-center gap-3 text-sm text-blue-100">
                <div className="h-2 w-2 rounded-full bg-emerald-300" />
                Secure healthcare platform
              </div>
            </div>
          </div>

          {/* Right side */}
          <div className="p-7 sm:p-10 lg:p-12">
            
            {/* Mobile branding */}
            <div className="mb-8 flex items-center justify-center gap-3 md:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white shadow-sm">
                S
              </div>

              <span className="text-2xl font-bold text-slate-900">
                SwasthSetu
              </span>
            </div>

            <div className="mb-8">
              <p className="mb-2 text-sm font-medium text-blue-600">
                Welcome back
              </p>

              <h1 className="text-3xl font-bold tracking-tight text-slate-900">
                Sign in to your account
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Enter your credentials to continue to SwasthSetu.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">

              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setErrors((prev) => ({
                      ...prev,
                      email: '',
                    }));
                    setApiError('');
                  }}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={`w-full rounded-xl border px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${
                    errors.email
                      ? 'border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                      : 'border-slate-300 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
                  }`}
                />

                {errors.email && (
                  <p className="mt-1.5 text-xs text-red-600">
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700"
                  >
                    Password
                  </label>
                </div>

                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setErrors((prev) => ({
                      ...prev,
                      password: '',
                    }));
                    setApiError('');
                  }}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className={`w-full rounded-xl border px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${
                    errors.password
                      ? 'border-red-400 bg-red-50/30 focus:border-red-500 focus:ring-4 focus:ring-red-100'
                      : 'border-slate-300 bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100'
                  }`}
                />

                {errors.password && (
                  <p className="mt-1.5 text-xs text-red-600">
                    {errors.password}
                  </p>
                )}
              </div>

              {/* API error */}
              {apiError && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-600">
                    !
                  </div>

                  <p className="text-sm leading-5 text-red-700">
                    {apiError}
                  </p>
                </div>
              )}

              {/* Submit */}
              <Button
                type="submit"
                loading={isLoading}
                loadingText="Signing in…"
                className="w-full rounded-xl py-3 text-sm font-semibold shadow-sm transition"
              >
                Sign in
              </Button>
            </form>

            {/* Register */}
            <div className="mt-7 border-t border-slate-100 pt-6 text-center">
              <p className="text-sm text-slate-500">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-blue-600 transition hover:text-blue-700 hover:underline"
                >
                  Create one
                </Link>
              </p>
            </div>

            {/* Small footer text */}
            <p className="mt-8 text-center text-xs text-slate-400">
              By continuing, you are accessing the SwasthSetu healthcare platform.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}