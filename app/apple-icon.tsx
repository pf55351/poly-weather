import { ImageResponse } from "next/og";

// Icona home-screen iOS: full-bleed (iOS applica la propria maschera arrotondata).
// Sfondo indaco con glow viola + wordmark "pb" col gradiente viola→ciano del brand.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundImage:
            "radial-gradient(120px 120px at 30% 10%, #2b2350, #14131f)",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 110,
            fontWeight: 900,
            letterSpacing: -6,
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
