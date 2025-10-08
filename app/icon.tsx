import { ImageResponse } from "next/og";

export const size = {
  width: 96,
  height: 96,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "#ffffff",
          borderRadius: 28,
          display: "flex",
          gap: 12,
          height: "100%",
          justifyContent: "center",
          width: "100%",
        }}
      >
        <span
          style={{
            color: "#1e3a8a",
            fontFamily: "Geist, Inter, system-ui, -apple-system, BlinkMacSystemFont",
            fontSize: 58,
            fontWeight: 900,
            letterSpacing: 0,
          }}
        >
          C
        </span>
        <span
          style={{
            color: "#1e3a8a",
            fontFamily: "Geist, Inter, system-ui, -apple-system, BlinkMacSystemFont",
            fontSize: 58,
            fontWeight: 900,
            marginTop: -8,
          }}
        >
          .
        </span>
      </div>
    ),
    size,
  );
}
