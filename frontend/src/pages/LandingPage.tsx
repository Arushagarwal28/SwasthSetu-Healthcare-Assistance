import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import Logo from '../components/brand/Logo';
import BridgeIllustration from '../components/brand/BridgeIllustration';

const focusRing =
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2';

const primaryLink = `inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-lg shadow-sm hover:bg-blue-700 transition-colors ${focusRing}`;
const secondaryLink = `inline-flex items-center justify-center px-6 py-3 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors ${focusRing}`;

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// `status` reflects what exists in the product today. Flip an item to
// 'available' as its feature ships.
type Status = 'available' | 'soon';

const FEATURES: { title: string; description: string; status: Status; icon: ReactNode }[] = [
  {
    title: 'Symptom assessment',
    description:
      'Select symptoms, add severity and duration, and answer follow-up questions when the picture is unclear.',
    status: 'available',
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 8v8M8 12h8" />
      </Icon>
    ),
  },
  {
    title: 'Disease screening',
    description:
      'A model-based screening suggestion with a clear confidence level. A starting point, not a diagnosis.',
    status: 'available',
    icon: (
      <Icon>
        <path d="M3 12h4l3-7 4 14 3-7h4" />
      </Icon>
    ),
  },
  {
    title: 'Facility referral',
    description:
      'Refer a patient to a suitable nearby facility and follow the hospital’s response.',
    status: 'available',
    icon: (
      <Icon>
        <path d="M4 12h15M14 7l5 5-5 5" />
      </Icon>
    ),
  },
  {
    title: 'Report simplification',
    description: 'Turn medical reports into plain-language summaries.',
    status: 'soon',
    icon: (
      <Icon>
        <path d="M7 3h7l5 5v13H7z" />
        <path d="M10 13h6M10 17h6" />
      </Icon>
    ),
  },
  {
    title: 'AI health assistant',
    description: 'Ask health questions in a simple conversational interface.',
    status: 'soon',
    icon: (
      <Icon>
        <path d="M4 5h16v11H9l-5 4z" />
      </Icon>
    ),
  },
  {
    title: 'Vaccination tracking',
    description: 'Keep track of vaccination schedules and upcoming doses.',
    status: 'soon',
    icon: (
      <Icon>
        <path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z" />
        <path d="M9 12l2 2 4-4" />
      </Icon>
    ),
  },
];

const STEPS: { title: string; description: string }[] = [
  {
    title: 'Describe symptoms',
    description:
      'Choose symptoms and add how severe they are and how long they have lasted, on your own or with a health worker.',
  },
  {
    title: 'Answer follow-ups',
    description:
      'If the picture is unclear, a few targeted yes/no questions help narrow down the possibilities.',
  },
  {
    title: 'Review the result',
    description:
      'See the model’s screening suggestion with a confidence level, along with other possibilities considered.',
  },
  {
    title: 'Reach the right care',
    description:
      'Request a referral to a suitable nearby facility and track the hospital’s response.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" aria-label="SwasthSetu home" className={`rounded ${focusRing}`}>
            <Logo />
          </Link>

          <nav aria-label="Primary" className="hidden md:flex items-center gap-7 text-sm">
            <a href="#features" className={`text-slate-600 hover:text-slate-900 rounded ${focusRing}`}>
              Features
            </a>
            <a href="#how-it-works" className={`text-slate-600 hover:text-slate-900 rounded ${focusRing}`}>
              How it works
            </a>
          </nav>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to="/login"
              className={`px-3 sm:px-4 py-2 text-sm font-medium text-slate-700 hover:text-slate-900 rounded-lg ${focusRing}`}
            >
              Log in
            </Link>
            <Link
              to="/register"
              className={`px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors ${focusRing}`}
            >
              Register
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="bg-gradient-to-b from-blue-50/80 to-white">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 sm:py-20 grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="inline-block text-xs font-semibold tracking-wide uppercase text-blue-700 bg-blue-100 rounded-full px-3 py-1 mb-5">
                Rural healthcare triage platform
              </p>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight text-slate-900">
                Bridging rural communities to the care they need
              </h1>
              <p className="mt-5 text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                SwasthSetu helps patients and health workers describe symptoms and receive a
                screening suggestion, with follow-up questions when the picture is unclear.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-3">
                <Link to="/register" className={primaryLink}>
                  Get started
                </Link>
                <Link to="/login" className={secondaryLink}>
                  Log in
                </Link>
              </div>
              <p className="mt-5 text-xs text-slate-500">
                Screening results are model-based suggestions, not a medical diagnosis.
              </p>
            </div>

            <div className="rounded-2xl border border-blue-100 bg-white p-6 sm:p-8 shadow-sm">
              <BridgeIllustration className="w-full h-auto text-blue-600" />
            </div>
          </div>
        </section>

        {/* Capabilities */}
        <section id="features" className="scroll-mt-16 border-t border-slate-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <div className="max-w-2xl">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">
                What SwasthSetu does
              </h2>
              <p className="mt-3 text-slate-600">
                Screening and referral are live. Other capabilities are marked so it is clear what
                is available today.
              </p>
            </div>

            <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-slate-200 bg-white p-5 hover:border-slate-300 hover:shadow-sm transition"
                >
                  <div className="flex items-start justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                      {f.icon}
                    </span>
                    <span
                      className={`text-[11px] font-medium rounded-full px-2.5 py-0.5 border ${
                        f.status === 'available'
                          ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                          : 'text-slate-600 bg-slate-50 border-slate-200'
                      }`}
                    >
                      {f.status === 'available' ? 'Available' : 'Coming soon'}
                    </span>
                  </div>
                  <h3 className="mt-4 font-medium text-slate-900">{f.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{f.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-16 bg-slate-50 border-t border-slate-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight">How it works</h2>
            <ol className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {STEPS.map((s, i) => (
                <li key={s.title} className="relative">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-semibold">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-medium text-slate-900">{s.title}</h3>
                  <p className="mt-1.5 text-sm text-slate-600 leading-relaxed">{s.description}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Closing CTA */}
        <section className="border-t border-slate-100">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Ready to try it?</h2>
            <p className="mt-2 text-slate-600">
              Create an account as a patient or as a health worker helper.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
              <Link to="/register" className={primaryLink}>
                Create an account
              </Link>
              <Link to="/login" className={secondaryLink}>
                Log in
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Logo />
          <p className="text-xs text-slate-500 text-center sm:text-right">
            A final-year academic project. Screening results are not a medical diagnosis.
          </p>
        </div>
      </footer>
    </div>
  );
}