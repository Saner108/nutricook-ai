import { useState, useEffect } from "react";
import { T } from "./tokens.js";

/**
 * Circular progress ring. `pct` is a 0–1 fraction of completion.
 * @param {{
 *   pct: number,
 *   color: string,
 *   size?: number,
 *   stroke?: number,
 *   children?: import("react").ReactNode,
 * }} props
 */
export default function Ring({ pct, color, size = 110, stroke = 10, children }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);
  useEffect(() => {
    const t = setTimeout(() => setOffset(circ * (1 - Math.min(pct, 1))), 150);
    return () => clearTimeout(t);
  }, [pct, circ]);
  return (
    <div style={{ position: "relative", width: size, height: size, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
      <svg width={size} height={size} style={{ position: "absolute", top: 0, left: 0 }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={T.g1} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.22,.68,0,1.2)" }}
        />
      </svg>
      <div style={{ textAlign: "center" }}>{children}</div>
    </div>
  );
}
