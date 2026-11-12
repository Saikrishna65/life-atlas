import type { ReactNode } from "react";

/** Line masks keep the complete heading in the semantic reading order. */
export function KineticHeading({
  lines,
  className = "",
}: {
  lines: ReactNode[];
  className?: string;
}) {
  return (
    <h2 className={`kinetic-heading ${className}`}>
      {lines.map((line, i) => (
        <span className="type-line" key={i}>
          <span className="type-line-inner">{line}</span>
        </span>
      ))}
    </h2>
  );
}

/** The drawn line is an editorial motif, not a geographic route or waypoint. */
export function RouteDrawing({
  className = "",
  variant = "journey",
}: {
  className?: string;
  variant?: "journey" | "memory";
}) {
  const path =
    variant === "journey"
      ? "M-40 500 C150 500 120 80 355 130 S580 710 720 400 S850 30 1060 200"
      : "M-20 90 C220 490 150 730 390 450 S500 20 700 180 S780 650 1020 540";
  return (
    <svg
      className={`editorial-route ${className}`}
      viewBox="0 0 1000 650"
      fill="none"
      aria-hidden="true"
    >
      <path className="route-underlay" d={path} />
      <path className="route-draw" pathLength="1" d={path} />
      <circle
        cx={variant === "journey" ? 355 : 390}
        cy={variant === "journey" ? 130 : 450}
        r="5"
      />
      <circle
        className="route-stop-ring"
        cx={variant === "journey" ? 720 : 700}
        cy={variant === "journey" ? 400 : 180}
        r="14"
      />
    </svg>
  );
}

export function ObservatoryDial() {
  return (
    <svg
      className="observatory-dial"
      viewBox="0 0 800 800"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="400" cy="400" r="340" />
      <circle className="dial-orbit" cx="400" cy="400" r="310" />
      <g>
        {Array.from({ length: 72 }, (_, i) => {
          const a = (i * Math.PI) / 36;
          const r = i % 6 === 0 ? 325 : 332;
          return (
            <line
              key={i}
              x1={400 + Math.cos(a) * r}
              y1={400 + Math.sin(a) * r}
              x2={400 + Math.cos(a) * 340}
              y2={400 + Math.sin(a) * 340}
            />
          );
        })}
      </g>
      <path d="M400 40V60 M400 740V760 M40 400H60 M740 400H760" />
      <text x="400" y="25">
        N
      </text>
      <text x="400" y="790">
        S
      </text>
      <text x="18" y="405">
        W
      </text>
      <text x="782" y="405">
        E
      </text>
    </svg>
  );
}
