import { loadFont } from "@remotion/google-fonts/Unbounded";
import { Video } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, Easing, Interactive, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { VERIFY_LINES } from "./verifyOutput";

export const { fontFamily } = loadFont("normal", { weights: ["300", "400", "500", "700"], subsets: ["latin"] });
const MONO = '"Cascadia Mono", Consolas, ui-monospace, monospace';

/** The recorded site sits in this window; captions use the black band below it. */
export const WINDOW = { left: 269, top: 40, width: 1382, height: 777 };

export const Backdrop: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill style={{ backgroundColor: "#000", fontFamily, color: "#fff" }}>{children}</AbsoluteFill>
);

/** One recorded clip from public/footage, framed. Timing props live on the parent Sequence. */
export const Footage: React.FC<{
  name: string;
  src: string;
  trimBefore: number;
  playbackRate: number;
  /** A fixed zoom towards `origin` (CSS transform-origin), so the site's small text reads on a phone. */
  zoom?: number;
  origin?: string;
}> = ({ name, src, trimBefore, playbackRate, zoom = 1, origin = "50% 50%" }) => (
  <div
    style={{
      position: "absolute",
      left: WINDOW.left,
      top: WINDOW.top,
      width: WINDOW.width,
      height: WINDOW.height,
      overflow: "hidden",
      outline: "1px solid rgba(255,255,255,0.22)",
    }}
  >
    <Video name={name} src={staticFile(src)} trimBefore={trimBefore} playbackRate={playbackRate} muted style={{ width: "100%", height: "100%", scale: zoom, transformOrigin: origin }} />
  </div>
);

/** A kicker and one or two lines under the window, faded in and out over its own Sequence. */
export const Caption: React.FC<{ kicker: string; text: string }> = ({ kicker, text }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <Interactive.Div
      name="Caption"
      style={{
        position: "absolute",
        left: WINDOW.left,
        top: WINDOW.top + WINDOW.height + 38,
        width: WINDOW.width,
        opacity: interpolate(frame, [0, 0.35 * fps, durationInFrames - 0.3 * fps, durationInFrames], [0, 1, 1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        translate: interpolate(frame, [0, 0.5 * fps], ["0px 18px", "0px 0px"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
        }),
      }}
    >
      <div style={{ fontSize: 24, letterSpacing: "0.18em", color: "rgba(255,255,255,0.6)", marginBottom: 14 }}>{kicker}</div>
      <div style={{ fontSize: 44, fontWeight: 400, lineHeight: 1.22 }}>{text}</div>
    </Interactive.Div>
  );
};

export const SpadeMark: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size * 1.13} viewBox="-15 -15 30 34">
    <path
      d="M0,-14 C5,-8 14,-3 14,4 C14,10 8,13 3,9 C3,12 4,15 7,17 L-7,17 C-4,15 -3,12 -3,9 C-8,13 -14,10 -14,4 C-14,-3 -5,-8 0,-14 Z"
      fill="none"
      stroke="#fff"
      strokeWidth="1.2"
    />
  </svg>
);

const rise = (frame: number, fps: number, at: number) => ({
  opacity: interpolate(frame, [at * fps, (at + 0.6) * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  translate: interpolate(frame, [at * fps, (at + 0.8) * fps], ["0px 30px", "0px 0px"], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  }),
});

export const TitleCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <Backdrop>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", gap: 34 }}>
        <div style={rise(frame, fps, 0)}>
          <SpadeMark size={96} />
        </div>
        <div style={{ ...rise(frame, fps, 0.25), fontSize: 26, letterSpacing: "0.3em", color: "rgba(255,255,255,0.65)" }}>
          SPADE · $TAKSIR × SIDAK
        </div>
        <div style={{ ...rise(frame, fps, 0.5), fontSize: 92, fontWeight: 700, lineHeight: 1.05 }}>
          RUG THE AI,
          <br />
          NOT THE HOLDERS.
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

/** `node scripts/verify.mjs`, typed, then its real output (src/verifyOutput.ts) line by line. */
export const Terminal: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const command = "node scripts/verify.mjs";
  const typed = command.slice(0, Math.max(0, Math.floor((frame - 0.4 * fps) / 2)));
  const outputStart = 0.4 * fps + command.length * 2 + 0.5 * fps;
  const shown = Math.max(0, Math.floor((frame - outputStart) / 4));
  return (
    <div
      style={{
        position: "absolute",
        left: WINDOW.left,
        top: WINDOW.top,
        width: WINDOW.width,
        height: WINDOW.height,
        outline: "1px solid rgba(255,255,255,0.22)",
        backgroundColor: "#0a0a0a",
        padding: "48px 56px",
        boxSizing: "border-box",
        fontFamily: MONO,
        fontSize: 27,
        lineHeight: 1.62,
      }}
    >
      <div>
        <span style={{ color: "rgba(255,255,255,0.45)" }}>Spade $ </span>
        {typed}
        {shown === 0 && Math.floor(frame / 15) % 2 === 0 ? "▋" : ""}
      </div>
      <div style={{ height: 18 }} />
      {VERIFY_LINES.slice(0, shown).map((line) => {
        const tag = line.slice(0, 4);
        const color = tag === "PASS" ? "#7dffa8" : tag === "WARN" ? "#ffd166" : tag === "FAIL" ? "#ff6b6b" : "#fff";
        const known = ["PASS", "WARN", "FAIL", "SKIP"].includes(tag);
        return (
          <div key={line} style={{ whiteSpace: "pre", fontWeight: known ? 400 : 700, marginTop: known ? 0 : 12 }}>
            {known ? <span style={{ color }}>{tag}</span> : null}
            {known ? line.slice(4) : line}
          </div>
        );
      })}
    </div>
  );
};

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line = { fontSize: 38, lineHeight: 1.5 } as const;
  return (
    <Backdrop>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", gap: 26 }}>
        <div style={rise(frame, fps, 0)}>
          <SpadeMark size={72} />
        </div>
        <div style={{ ...rise(frame, fps, 0.2), fontSize: 76, fontWeight: 700 }}>SPADE</div>
        <div style={{ ...rise(frame, fps, 0.4), ...line }}>
          github.com/Axlnd3r/Spade
          <br />
          axlnd3r.github.io/Spade
        </div>
        <div style={{ ...rise(frame, fps, 0.7), fontSize: 26, letterSpacing: "0.16em", color: "rgba(255,255,255,0.65)" }}>
          BUILT FOR THE NEAR HACKATHON 2026 · #NEARHACKATHON
        </div>
        <div style={{ ...rise(frame, fps, 0.9), fontSize: 22, color: "rgba(255,255,255,0.5)" }}>
          NEAR testnet demo. Not audited.
        </div>
      </AbsoluteFill>
    </Backdrop>
  );
};

