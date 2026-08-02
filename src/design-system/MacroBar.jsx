import { useState, useEffect } from "react";
import { T } from "./tokens.js";

/**
 * Labeled progress bar for a macro value against a max, on a light card.
 * @param {{ label: string, value: number, max: number, color: string }} props
 */
export default function MacroBar({ label, value, max, color }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(Math.min((value / max) * 100, 100)), 200);
    return () => clearTimeout(t);
  }, [value, max]);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
        <span style={{ color: T.g4, fontWeight: 500 }}>{label}</span>
        <span style={{ color: T.black, fontWeight: 700 }}>{value}g</span>
      </div>
      <div style={{ height: 6, background: T.g2, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 99, transition: "width 1s cubic-bezier(.22,.68,0,1.2)" }} />
      </div>
    </div>
  );
}
