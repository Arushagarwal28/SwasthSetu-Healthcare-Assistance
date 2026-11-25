interface Props {
  className?: string;
}

/**
 * Line-art illustration of a bridge between a village and a hospital
 * ("setu" = bridge). Colour comes from `currentColor`, so set it with a
 * text-* class on the parent/className.
 */
export default function BridgeIllustration({ className = '' }: Props) {
  return (
    <svg
      viewBox="0 0 480 280"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label="A bridge connecting a village to a hospital"
    >
      {/* river */}
      <path d="M0 238c20-8 40-8 60 0s40 8 60 0 40-8 60 0 40 8 60 0 40-8 60 0 40 8 60 0 40-8 60 0 40 8 60 0" opacity={0.35} strokeWidth={2} />
      <path d="M0 258c20-8 40-8 60 0s40 8 60 0 40-8 60 0 40 8 60 0 40-8 60 0 40 8 60 0 40-8 60 0 40 8 60 0" opacity={0.2} strokeWidth={2} />

      {/* banks */}
      <rect x="0" y="205" width="130" height="60" fill="currentColor" fillOpacity={0.08} stroke="none" />
      <rect x="350" y="205" width="130" height="60" fill="currentColor" fillOpacity={0.08} stroke="none" />
      <path d="M0 205h130M350 205h130" />

      {/* bridge deck + arch + hangers */}
      <path d="M130 205h220" />
      <path d="M130 205Q240 95 350 205" />
      <path d="M170 172v33M205 156v49M240 150v55M275 156v49M310 172v33" strokeWidth={2} />

      {/* village house */}
      <rect x="45" y="170" width="50" height="35" />
      <path d="M38 172l32-27 32 27" />
      <rect x="63" y="185" width="14" height="20" />

      {/* hospital */}
      <rect x="385" y="140" width="60" height="65" />
      <path d="M415 153v24M403 165h24" strokeWidth={4} />
      <rect x="407" y="187" width="16" height="18" />
    </svg>
  );
}