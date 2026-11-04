type Props = {
  className?: string;
};

export function KusogLogo({ className = '' }: Props) {
  return (
    <svg viewBox="0 0 220 220" className={className} role="img" aria-label="KUSOG logo">
      <defs>
        <linearGradient id="kusogRing" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#063875" />
          <stop offset="0.55" stopColor="#078bd8" />
          <stop offset="1" stopColor="#18a9a3" />
        </linearGradient>
        <linearGradient id="kusogWave" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#078ee4" />
          <stop offset="1" stopColor="#127d9b" />
        </linearGradient>
        <linearGradient id="kusogGlass" x1="0" y1="0" x2="0.9" y2="1">
          <stop stopColor="#e2f7ff" />
          <stop offset="1" stopColor="#72b9dd" />
        </linearGradient>
      </defs>

      <circle cx="110" cy="110" r="101" fill="#031a42" stroke="url(#kusogRing)" strokeWidth="5" />
      <path d="M23 138c34 35 83 47 134 30 22-7 40-19 54-34-14 39-53 67-101 67-40 0-73-18-87-63Z" fill="url(#kusogWave)" />
      <path d="M35 61c25-43 80-59 126-32 20 12 35 27 44 47-30-25-66-35-103-27-27 6-48 20-67 42Z" fill="#087acb" opacity=".8" />

      <path d="M110 42c27 0 49 19 49 43 0 21-16 37-37 39 12-7 19-18 19-31 0-18-15-32-34-32-11 0-21 5-28 13 4-18 16-32 31-32Z" fill="#57c9ff" />
      <path d="M110 44c-21 8-31 25-27 43 3 14 13 23 26 28-19 1-38-10-46-28-10-24 8-48 47-43Z" fill="#0c83d5" />
      <path d="M153 70c-3-13-13-23-26-28 18-1 35 8 43 24 10 21-2 45-30 55 14-13 18-31 13-51Z" fill="#0a6ebc" />
      <path d="M128 108c-11 12-26 16-41 11 8 12 23 17 37 13 17-5 27-19 26-34-5 4-13 7-22 10Z" fill="#62d4ff" />
      <circle cx="111" cy="83" r="8" fill="#021a3c" />

      <path d="M47 128 105 105l66 24-59 18Z" fill="#092d61" stroke="#021b42" strokeWidth="3" />
      <path d="M57 129v41h90v-39l-42-15Z" fill="#0d3c69" stroke="#031b40" strokeWidth="3" />
      <path d="M65 133v31h25v-36Zm31-8v39h18v-32Zm24 8v31h18v-25Z" fill="url(#kusogGlass)" stroke="#082753" strokeWidth="2" />
      <path d="M58 171h90" stroke="#021b42" strokeWidth="5" />

      <path d="M31 69v59M23 80h16M27 90h10M23 101h17" stroke="#052456" strokeWidth="4" strokeLinecap="round" />
      <circle cx="23" cy="66" r="7" fill="#052456" />
      <circle cx="40" cy="66" r="7" fill="#052456" />
      <path d="m31 75 17 10-17 8Z" fill="#06336b" stroke="#021b42" strokeWidth="2" />

      <rect x="151" y="126" width="45" height="34" rx="2" fill="#071e48" stroke="#0a9ddd" strokeWidth="3" />
      <path d="M157 151 166 142l6 4 9-12 10 5" fill="none" stroke="#48caff" strokeWidth="3" />
      <path d="M160 155h4v-7h4v7h4v-12h4v12h4v-18h4v18" fill="none" stroke="#1a9edc" strokeWidth="2" />
      <path d="M172 160v10h-12M172 170h18" stroke="#071e48" strokeWidth="4" />
      <path d="M181 93c-5 8-7 12-7 16a7 7 0 0 0 14 0c0-4-2-8-7-16Z" fill="#18a9c3" stroke="#063875" strokeWidth="2" />
      <path d="M194 105c-4 6-5 9-5 12a6 6 0 0 0 12 0c0-3-2-6-7-12Z" fill="#18a9c3" />
    </svg>
  );
}