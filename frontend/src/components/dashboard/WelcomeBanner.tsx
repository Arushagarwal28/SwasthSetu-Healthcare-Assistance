import BridgeIllustration from '../brand/BridgeIllustration';

interface Props {
  name?: string;
  subtitle: string;
}

export default function WelcomeBanner({ name, subtitle }: Props) {
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white px-6 py-7 sm:px-8 sm:py-9 shadow-sm">
      <div className="relative z-10 max-w-xl">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">
          {name ? `Welcome, ${name}` : 'Welcome to SwasthSetu'}
        </h1>
        <p className="mt-2 text-sm sm:text-base text-blue-50 leading-relaxed">{subtitle}</p>
      </div>
      <BridgeIllustration className="hidden md:block absolute right-6 bottom-0 w-64 text-white/25" />
    </section>
  );
}