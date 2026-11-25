// Class strings for <Link> elements that should look like buttons
// (avoids nesting a <button> inside an <a>).
const base =
  'inline-flex items-center justify-center text-sm font-medium rounded-md px-5 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2';

export const primaryButtonLink = `${base} text-white bg-blue-600 hover:bg-blue-700`;
export const secondaryButtonLink = `${base} text-slate-700 bg-white border border-slate-300 hover:bg-slate-50`;