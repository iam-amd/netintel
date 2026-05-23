import type { CSSProperties, ReactNode } from "react";
import { riskTier } from "../uiData";

export type RiskTier = "low" | "elevated" | "high";

export function Sparkline({
  values,
  width = 72,
  height = 22,
  stroke,
  fill,
  dotLast = true,
}: {
  values: number[];
  width?: number;
  height?: number;
  stroke: string;
  fill?: string;
  dotLast?: boolean;
}) {
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1 || 1)) * w;
    const y = pad + h - ((v - min) / range) * h;
    return [x, y] as const;
  });
  const d = pts
    .map((p, i) => (i === 0 ? `M${p[0]} ${p[1]}` : `L${p[0]} ${p[1]}`))
    .join(" ");
  const last = pts[pts.length - 1];
  const first = pts[0];
  const dFill = `${d} L${last[0]} ${pad + h} L${first[0]} ${pad + h} Z`;
  return (
    <svg width={width} height={height} style={{ display: "block" }}>
      {fill && fill !== "none" ? <path d={dFill} fill={fill} /> : null}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {dotLast ? <circle cx={last[0]} cy={last[1]} r={1.75} fill={stroke} /> : null}
    </svg>
  );
}

export function RiskBar({
  value,
  width = 56,
  height = 6,
}: {
  value: number;
  width?: number;
  height?: number;
}) {
  const { tier } = riskTier(value);
  const color =
    tier === "high"
      ? "var(--risk-high)"
      : tier === "elevated"
        ? "var(--risk-mid)"
        : "var(--risk-low)";
  return (
    <div
      style={{
        position: "relative",
        width,
        height,
        background: "var(--track)",
        borderRadius: 999,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          width: `${Math.max(4, value * 100)}%`,
          background: color,
          borderRadius: 999,
        }}
      />
    </div>
  );
}

export function Gauge({ value, size = 168 }: { value: number; size?: number }) {
  const r = size / 2 - 14;
  const cx = size / 2;
  const cy = size / 2 + 8;
  const circ = Math.PI * r;

  const { tier, label } = riskTier(value);
  const color =
    tier === "high"
      ? "var(--risk-high)"
      : tier === "elevated"
        ? "var(--risk-mid)"
        : "var(--risk-low)";

  const startX = cx - r;
  const startY = cy;
  const endX = cx + r;
  const endY = cy;
  const dArc = `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${endX} ${endY}`;
  const dash = `${circ * value} ${circ}`;

  return (
    <div style={{ position: "relative", width: size, height: size / 2 + 18 }}>
      <svg width={size} height={size / 2 + 18} style={{ overflow: "visible" }}>
        <path d={dArc} fill="none" stroke="var(--track)" strokeWidth={10} strokeLinecap="round" />
        <path
          d={dArc}
          fill="none"
          stroke={color}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={dash}
          style={{
            transition:
              "stroke-dasharray 320ms cubic-bezier(.4,0,.2,1), stroke 200ms",
          }}
        />
      </svg>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: size / 2 - 30,
          textAlign: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            fontFamily: "var(--mono)",
            fontSize: 30,
            fontWeight: 500,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
          }}
        >
          {(value * 100).toFixed(1)}
          <span style={{ fontSize: 18, color: "var(--muted-1)" }}>%</span>
        </div>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--muted-1)",
            marginTop: 2,
          }}
        >
          {label} risk
        </div>
      </div>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (next: number) => void;
  hint?: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="slider-row">
      <div className="slider-head">
        <span className="slider-label">{label}</span>
        <span className="slider-val">
          {value}
          {unit ? <span className="slider-unit">{unit}</span> : null}
        </span>
      </div>
      <div
        className="slider-track-wrap"
        style={{ "--pct": `${pct}%` } as CSSProperties}
      >
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="slider-input"
        />
      </div>
      {hint ? <div className="slider-hint">{hint}</div> : null}
    </div>
  );
}

export type PillTone = "neutral" | "good" | "warn" | "bad";

export function Pill({
  tone = "neutral",
  children,
  dot,
}: {
  tone?: PillTone;
  children: ReactNode;
  dot?: boolean;
}) {
  return (
    <span className={`pill pill-${tone}`}>
      {dot ? <span className="pill-dot" /> : null}
      {children}
    </span>
  );
}

const ICONS: Record<string, ReactNode> = {
  search: (
    <>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5L13.5 13.5" strokeLinecap="round" />
    </>
  ),
  upload: (
    <>
      <path d="M8 10V3M5 6l3-3 3 3" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M3 11v1.5A1.5 1.5 0 0 0 4.5 14h7a1.5 1.5 0 0 0 1.5-1.5V11"
        strokeLinecap="round"
      />
    </>
  ),
  chevron: <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />,
  "arrow-up": (
    <path d="M8 13V3M4 7l4-4 4 4" strokeLinecap="round" strokeLinejoin="round" />
  ),
  "arrow-down": (
    <path d="M8 3v10M4 9l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
  ),
  check: (
    <path
      d="M3.5 8.5L6.5 11.5 12.5 5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  mail: (
    <>
      <rect x="2" y="4" width="12" height="9" rx="1.5" />
      <path d="M2.5 5l5.5 4 5.5-4" />
    </>
  ),
  phone: (
    <path d="M3 4.5C3 3.7 3.7 3 4.5 3h1.7c.3 0 .6.2.7.5l.8 2.3c.1.3 0 .6-.2.8L6.4 7.6c.7 1.5 1.9 2.7 3.4 3.4l1-1.1c.2-.2.5-.3.8-.2l2.3.8c.3.1.5.4.5.7v1.7c0 .8-.7 1.5-1.5 1.5C7 14.4 1.6 9 1.6 4.5z" />
  ),
};

export function Icon({
  name,
  size = 14,
}: {
  name: keyof typeof ICONS | "logo" | "dot" | "play";
  size?: number;
}) {
  const style: CSSProperties = {
    width: size,
    height: size,
    display: "inline-block",
    verticalAlign: -2,
  };
  if (name === "logo") {
    return (
      <svg viewBox="0 0 24 24" style={style} fill="none">
        <rect x="2" y="2" width="20" height="20" rx="5" fill="var(--ink)" />
        <path
          d="M7 16V8m0 0l5 5M12 8v8m0-8l5 5"
          stroke="var(--paper)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (name === "dot") {
    return (
      <svg viewBox="0 0 8 8" style={style}>
        <circle cx="4" cy="4" r="3" fill="currentColor" />
      </svg>
    );
  }
  if (name === "play") {
    return (
      <svg viewBox="0 0 16 16" style={style} fill="currentColor">
        <path d="M5 3.5v9l7-4.5z" />
      </svg>
    );
  }
  const path = ICONS[name];
  if (!path) return null;
  return (
    <svg
      viewBox="0 0 16 16"
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
    >
      {path}
    </svg>
  );
}
