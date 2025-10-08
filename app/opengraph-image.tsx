import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

const gradient = "radial-gradient(circle at top left, rgba(99,102,241,0.35), transparent 45%), radial-gradient(circle at bottom right, rgba(14,165,233,0.35), transparent 40%), linear-gradient(135deg, #0f172a, #1e1b4b)";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: gradient,
          color: "#f8fafc",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Geist, Inter, system-ui, -apple-system, BlinkMacSystemFont",
          height: "100%",
          justifyContent: "center",
          padding: "72px",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            background: "rgba(15,23,42,0.35)",
            border: "1px solid rgba(148,163,184,0.25)",
            borderRadius: 24,
            display: "flex",
            fontSize: 30,
            fontWeight: 600,
            gap: 16,
            letterSpacing: "-0.02em",
            padding: "18px 28px",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              alignItems: "center",
              background: "linear-gradient(135deg, #6366f1, #0ea5e9)",
              borderRadius: 12,
              color: "#0f172a",
              display: "flex",
              fontSize: 28,
              fontWeight: 700,
              height: 56,
              justifyContent: "center",
              width: 56,
            }}
          >
            C
          </span>
          CODA PLATFORM
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 24,
            marginTop: 72,
            maxWidth: 760,
          }}
        >
          <h1
            style={{
              fontSize: 80,
              fontWeight: 700,
              letterSpacing: "-0.04em",
              lineHeight: 1.05,
            }}
          >
            Capture the spark. Ship the idea.
          </h1>
          <p
            style={{
              color: "rgba(226,232,240,0.85)",
              fontSize: 32,
              letterSpacing: "-0.01em",
              lineHeight: 1.4,
            }}
          >
            Manage your entire product backlog with instant search, undo history, and polished flows built on the Coda MVP.
          </p>
        </div>

        <div
          style={{
            alignItems: "center",
            color: "rgba(148,163,184,0.85)",
            display: "flex",
            fontSize: 26,
            gap: 16,
            marginTop: 88,
          }}
        >
          <div
            style={{
              background: "rgba(148,163,184,0.35)",
              height: 2,
              width: 64,
            }}
          />
          codacli.com
        </div>
      </div>
    ),
    size,
  );
}
