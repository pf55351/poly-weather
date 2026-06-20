import { ImageResponse } from "next/og";

// Favicon generata: tile scuro indaco + wordmark "pb" col gradiente viola→ciano
// del brand (coerente col logo in header e con .text-gradient di globals.css).
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#181626",
          borderRadius: 7,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 22,
            fontWeight: 900,
            letterSpacing: -1,
            backgroundImage: "linear-gradient(100deg, #c77dff, #46c7f0)",
            backgroundClip: "text",
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          pb
        </div>
      </div>
    ),
    { ...size },
  );
}
