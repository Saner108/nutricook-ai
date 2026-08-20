import { useState, useEffect } from "react";
import { T } from "./tokens.js";

/**
 * Labeled progress bar for a macro value against a target, tuned for the
 * dark gradient hero card (white/translucent text and track).
 * @param {{ label: string, value: number, target: number, color: string }} props
 */
export default function MacroRow({ label, value, target, color }) {
  const [w, setW] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setW(Math.min((value / target) * 100, 100)), 250);
    return () => clearTimeout(t);
  }, [value, target]);
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>{label}</span>
        <span style={{ color: T.white, fontWeight: 700 }}>
          {value}
          <span style={{ color: "rgba(255,255,255,0.4)", fontWeight: 400 }}>/{target}g</span>
        </span>
      </div>
      <div style={{ height: 5, background: "rgba(255,255,255,0.15)", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${w}%`, background: color, borderRadius: 99, transition: "width 1s cubic-bezier(.22,.68,0,1.2)" }} />
      </div>
    </div>
  );
}
