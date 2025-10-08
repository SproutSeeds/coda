import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#ffffff",
          color: "#0f172a",
          display: "flex",
          flexDirection: "column",
          fontFamily: "Geist, Inter, system-ui, -apple-system, BlinkMacSystemFont",
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <div
          style={{
            alignItems: "center",
            display: "flex",
            gap: 96,
            justifyContent: "center",
            letterSpacing: "-0.08em",
          }}
        >
          <span
            style={{
              color: "#1d4ed8",
              fontSize: 220,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            C
          </span>
          <span
            style={{
              color: "#1d4ed8",
              fontSize: 220,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            .
          </span>
        </div>
        <p
          style={{
            color: "#0f172a",
            fontSize: 48,
            fontWeight: 500,
            letterSpacing: "-0.03em",
            marginTop: 48,
          }}
        >
          Where ideas go live
        </p>
      </div>
    ),
    size,
  );
}
