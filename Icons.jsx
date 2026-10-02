// Simple line drawings of clothes. Stroke uses currentColor.
const P = {
  tank: <path d="M15 6v6q-3 4-3 9v12h16V21q0-5-3-9V6M15 6q5 8 10 0" />,
  tee: <path d="M14 8 8 12l-3 6 5 2 1-3v16h18V17l1 3 5-2-3-6-6-4q-6 4-12 0Z" />,
  longsleeve: <path d="M14 8 8 11 5 30l4 1 2-14v16h18V17l2 14 4-1-3-19-6-3q-6 4-12 0Z" />,
  sweater: (
    <>
      <path d="M14 8 8 11 5 30l4 1 2-14v16h18V17l2 14 4-1-3-19-6-3q-6 4-12 0Z" />
      <path d="M11 30h18M5.5 27.5l4 1M34.5 27.5l-4 1" />
    </>
  ),
  jacket: (
    <>
      <path d="M14 7 8 10 5 30l4 1 2-14v16h18V17l2 14 4-1-3-20-6-3-6 6Z" />
      <path d="M20 13v20M14 7l3 9M26 7l-3 9" />
    </>
  ),
  coat: (
    <>
      <path d="M14 6 8 10 5 32l4 1 2-15v18h18V18l2 15 4-1-3-22-6-4-6 6Z" />
      <path d="M20 12v24" />
      <circle cx="23" cy="19" r="1" /><circle cx="23" cy="25" r="1" /><circle cx="23" cy="31" r="1" />
    </>
  ),
  raincoat: (
    <>
      <path d="M14 9q0-7 6-7t6 7" />
      <path d="M14 9 8 12 5 32l4 1 2-14v17h18V19l2 14 4-1-3-20-6-3q-6 5-12 0Z" />
      <path d="M20 14v22" />
    </>
  ),
  shorts: <path d="M10 10h20l2 16-10 1-2-10-2 10-10-1Z M10 14h20" />,
  pants: <path d="M12 6h16l2 29h-7L20 15l-3 20h-7Z M12 10h16" />,
  sneaker: <path d="M5 27 6 16q5 1 8-2l4 4q7 3 15 4 3 1 2 6H5Z M5 27v3h30v-2M14 18l2 2M17 16l2 2" />,
  boot: <path d="M12 6h10v16q8 1 11 4v6H12Z M12 28h21M12 10h10" />,
  sandal: <path d="M5 28q15-5 30 0v3Q20 27 5 31Z M12 27l6-8 6 8" />,
  umbrella: <path d="M6 20Q20 2 34 20q-4-3-7 0-4-3-7 0-3-3-7 0-3-3-7 0Z M20 20v11q0 3-3 2" />,
  sunglasses: (
    <>
      <path d="M5 18h30M18 22q2-2 4 0" />
      <circle cx="12" cy="22" r="5" /><circle cx="28" cy="22" r="5" />
    </>
  ),
  beanie: (
    <>
      <path d="M9 26q0-16 11-16t11 16Z M8 26h24v5H8Z" />
      <circle cx="20" cy="7" r="2.5" />
    </>
  ),
  hairtie: (
    <>
      <circle cx="20" cy="20" r="11" /><circle cx="20" cy="20" r="6" />
    </>
  ),
};

export default function Icon({ name, size = 40 }) {
  return (
    <svg
      viewBox="0 0 40 40" width={size} height={size} aria-hidden="true"
      fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    >
      {P[name] || P.tee}
    </svg>
  );
}
