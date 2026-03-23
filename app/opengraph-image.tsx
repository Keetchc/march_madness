import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Brian's Group — March Madness";

export const size = { width: 1200, height: 630 };

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0f0e0c 0%, #1a1814 42%, #312c20 100%)",
          padding: 72,
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 28,
            marginBottom: 28,
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: 20,
              background: "#252219",
              border: "3px solid #ff7c0a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 999,
                border: "3px solid #ff7c0a",
                background: "#1a1814",
              }}
            />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontSize: 58,
                fontWeight: 900,
                color: "#ffffff",
                letterSpacing: -2,
                lineHeight: 1,
              }}
            >
              Brian&apos;s Group
            </span>
            <span
              style={{
                fontSize: 38,
                fontWeight: 800,
                color: "#ff9a32",
                textTransform: "uppercase",
                letterSpacing: 3,
              }}
            >
              March Madness
            </span>
          </div>
        </div>
        <p
          style={{
            fontSize: 30,
            color: "#a8a29e",
            maxWidth: 820,
            lineHeight: 1.45,
            margin: 0,
          }}
        >
          Brackets, leaderboard, compare picks — one place for your pool.
        </p>
      </div>
    ),
    { ...size },
  );
}
