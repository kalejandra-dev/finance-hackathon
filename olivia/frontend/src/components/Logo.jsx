/** Logotipo de OlivIA: una aceituna con hoja (SVG propio, decorativo). */
export default function Logo({ size = 36 }) {
  return (
    <svg className="logo" width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path d="M27 13 C 29 9, 32 7, 35 6" fill="none" stroke="#5c7322" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M33 7 C 37 2, 44 2, 46 5 C 42 9, 37 10, 33 7 Z" fill="#9bbd3e" />
      <ellipse cx="22" cy="28" rx="13" ry="16" transform="rotate(-22 22 28)" fill="#6f8f2a" />
      <ellipse cx="17" cy="24" rx="4" ry="7" transform="rotate(-22 17 24)" fill="#a9c75a" opacity=".55" />
      <circle cx="27.5" cy="19.5" r="4.6" fill="#d9483b" />
      <circle cx="26.5" cy="18.5" r="1.4" fill="#f08a7f" />
    </svg>
  );
}
