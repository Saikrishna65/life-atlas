/** Original vector objects for the hero's editorial discovery panels. */
export function JourneyJournal() {
  return (
    <svg viewBox="0 0 150 170" fill="none" aria-hidden="true">
      <defs>
        <linearGradient
          id="journal-cover"
          x1="35"
          y1="15"
          x2="110"
          y2="145"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#fafafa" />
          <stop offset=".5" stopColor="#c5c8ca" />
          <stop offset="1" stopColor="#8b9297" />
        </linearGradient>
        <linearGradient id="journal-spine">
          <stop stopColor="#51565a" />
          <stop offset=".5" stopColor="#acb1b4" />
          <stop offset="1" stopColor="#33393d" />
        </linearGradient>
        <filter
          id="journal-shadow"
          x="-50%"
          y="-30%"
          width="200%"
          height="190%"
        >
          <feDropShadow dx="4" dy="9" stdDeviation="7" floodOpacity=".45" />
        </filter>
      </defs>
      <ellipse cx="77" cy="151" rx="37" ry="5" fill="#000" opacity=".25" />
      <g filter="url(#journal-shadow)" transform="rotate(-7 75 80)">
        <path d="M37 21 106 15 114 138 45 145Z" fill="url(#journal-spine)" />
        <path d="M43 23 110 18 117 135 50 142Z" fill="#ddd" />
        <path d="M40 18 109 12 116 132 47 138Z" fill="url(#journal-cover)" />
        <path d="m40 18 7 120 6-.5-7-120Z" fill="url(#journal-spine)" />
        <path d="m55 35 43-4 5 75-43 4Z" stroke="#50585e" strokeWidth=".5" />
        <path
          d="m64 88 10-22 9 13 12-30M62 96l13-12 9 10 13-8"
          stroke="#747e85"
          strokeWidth=".8"
        />
        <circle cx="74" cy="66" r="2.4" fill="#424d56" />
        <circle cx="95" cy="49" r="2" fill="#424d56" />
        <text
          x="78"
          y="49"
          fill="#252d33"
          textAnchor="middle"
          fontFamily="Georgia,serif"
          fontSize="9"
          letterSpacing="2"
        >
          LIFE
        </text>
        <text
          x="79"
          y="60"
          fill="#252d33"
          textAnchor="middle"
          fontFamily="Georgia,serif"
          fontSize="9"
          letterSpacing="1"
        >
          ATLAS
        </text>
        <text
          x="81"
          y="120"
          fill="#424c53"
          textAnchor="middle"
          fontFamily="sans-serif"
          fontSize="4"
          letterSpacing="1.4"
        >
          FIELD JOURNAL
        </text>
        <path d="m99 13 7 119-6 9-3-8-7-119" fill="#333c43" opacity=".9" />
      </g>
    </svg>
  );
}

export function ObservatoryInstrument() {
  return (
    <svg viewBox="0 0 145 180" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="instrument-metal">
          <stop stopColor="#353d42" />
          <stop offset=".25" stopColor="#c2cbd0" />
          <stop offset=".43" stopColor="#f2f5f6" />
          <stop offset=".64" stopColor="#71818a" />
          <stop offset="1" stopColor="#232d33" />
        </linearGradient>
        <radialGradient id="instrument-globe" cx=".34" cy=".25" r=".76">
          <stop stopColor="#e1e9ee" />
          <stop offset=".35" stopColor="#8396a0" />
          <stop offset=".8" stopColor="#283a44" />
          <stop offset="1" stopColor="#111b21" />
        </radialGradient>
      </defs>
      <ellipse cx="73" cy="169" rx="39" ry="5" fill="#000" opacity=".3" />
      <path
        d="m51 164 10-58h23l10 58M61 107l23 57M84 107l-23 57"
        stroke="url(#instrument-metal)"
        strokeWidth="2"
      />
      <path d="M48 165h49v4H48z" fill="url(#instrument-metal)" />
      <ellipse
        cx="73"
        cy="89"
        rx="27"
        ry="33"
        transform="rotate(-22 73 89)"
        stroke="url(#instrument-metal)"
        strokeWidth="3"
      />
      <circle
        cx="73"
        cy="88"
        r="24"
        fill="url(#instrument-globe)"
        stroke="#9aa9b1"
        strokeWidth=".7"
      />
      <ellipse
        cx="73"
        cy="88"
        rx="12"
        ry="24"
        transform="rotate(-22 73 88)"
        stroke="#dce4e8"
        strokeWidth=".55"
        opacity=".6"
      />
      <path
        d="M51 81q23 11 44 15M51 95q22 9 43 0M55 72q19 10 37 12"
        stroke="#dce4e8"
        strokeWidth=".5"
        opacity=".6"
      />
      <ellipse
        cx="73"
        cy="92"
        rx="37"
        ry="9"
        transform="rotate(-13 73 92)"
        stroke="url(#instrument-metal)"
        strokeWidth="2"
      />
      <path
        d="M73 53v8M73 116v10M45 132h56M68 125h10v12H68z"
        stroke="url(#instrument-metal)"
        strokeWidth="2"
      />
      <path d="M69 49h8l-1 5h-6z" fill="url(#instrument-metal)" />
      <circle cx="73" cy="135" r="3" fill="#ccd6dc" />
    </svg>
  );
}
