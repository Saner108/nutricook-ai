import { useState } from "react";
import { T } from "./tokens.js";

/**
 * @param {{
 *   label: string,
 *   onPress?: () => void,
 *   primary?: boolean,
 *   small?: boolean,
 *   style?: object,
 * }} props
 */
export default function Button({ label, onPress, primary, small, style: st }) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      onClick={onPress}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      onMouseLeave={() => setPressed(false)}
      style={{
        padding: small ? "8px 16px" : "14px 24px",
        borderRadius: 14,
        border: "none",
        background: primary ? T.mintDark : T.g1,
        color: primary ? T.white : T.g6,
        fontSize: small ? 13 : 15,
        fontWeight: 700,
        cursor: "pointer",
        transform: pressed ? "scale(0.97)" : "scale(1)",
        transition: "transform 0.1s",
        letterSpacing: 0.2,
        fontFamily: "inherit",
        ...st,
      }}
    >
      {label}
    </button>
  );
}
