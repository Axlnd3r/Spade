import type React from "react";
import { AbsoluteFill, Easing, Img, interpolate, interpolateColors, random, Sequence, useCurrentFrame, useVideoConfig } from "remotion";
import mrxArt from "../../web/src/scene/mrx-gembok.png";
import { fontFamily } from "./parts";
import { Music, Sfx } from "./sound";

// The opening: what Spade is, before the live site appears. One card stays on stage for all four beats:
// it floats spade-side up, turns to show Mr. X, becomes the appraiser in the diagram of the mechanic, and
// ends as the mark above the tagline. All timings are in frames at 30 fps.

/** The four beats: memecoins rug holders (4 s), here the holders rug the AI (5 s), how (7.5 s), tagline (4.4 s). */
const BEATS = { rug: 120, mrx: 150, mechanic: 225, lockup: 132 };
/** Frame 0 of the mechanic beat and of the lockup beat: the card's keyframes hang on these. */
const MECHANIC = BEATS.rug + BEATS.mrx;
const LOCKUP = MECHANIC + BEATS.mechanic;
export const INTRO_FRAMES = LOCKUP + BEATS.lockup;
// The mechanic beat, in its own frames. Each ask is a light along the wire, a turn of the card, an answer.
/** Where step 2 (SIDAK) and step 3 (BUSTED) begin. */
const STEPS = { sidak: 70, busted: 145 };
/** The card starts turning for the first ask and for the second; a turn takes `TURN` frames. */
const ASK_1 = 30;
const ASK_2 = 104;
const TURN = 30;
/** The BUSTED stamp starts coming down; it lands 6 frames later. */
const STAMP = 158;

const SPADE = "M0,-14 C5,-8 14,-3 14,4 C14,10 8,13 3,9 C3,12 4,15 7,17 L-7,17 C-4,15 -3,12 -3,9 C-8,13 -14,10 -14,4 C-14,-3 -5,-8 0,-14 Z";
const MONO = '"Cascadia Mono", Consolas, ui-monospace, monospace';
const CLAMP = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const OUT = Easing.bezier(0.16, 1, 0.3, 1);
const IN_OUT = Easing.bezier(0.65, 0, 0.35, 1);
/** The site's light colours: padlock, sceptre, pistol (cases), key (verify). */
const INDIGO = "#6a5cff";
const BLUE = "#3fb6ff";
const MAGENTA = "#d24cff";
const GREEN = "#7dffb5";

const tint = (color: string, percent: number) => `color-mix(in srgb, ${color} ${percent}%, transparent)`;

// ── The card ────────────────────────────────────────────────────────────────────────────────────────

/** The card's back, after web/src/scene/cardArt.ts. */
const SpadeFace: React.FC = () => (
  <svg viewBox="0 0 250 350" width="100%" height="100%" style={{ display: "block" }}>
    <defs>
      <pattern id="intro-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <line x1="0" y1="0" x2="0" y2="8" stroke="#fff" strokeOpacity="0.07" strokeWidth="2" />
      </pattern>
    </defs>
    <rect width="250" height="350" fill="#0E0E10" />
    <rect x="12" y="12" width="226" height="326" rx="8" fill="url(#intro-hatch)" stroke="#fff" strokeOpacity="0.55" strokeWidth="1" />
    <path transform="translate(125 150) scale(4.2)" d={SPADE} fill="#fff" />
    <text x="125" y="262" fill="#fff" fontFamily={fontFamily} fontWeight="700" fontSize="15" letterSpacing="5" textAnchor="middle">
      SPADE
    </text>
    <text x="125" y="284" fill="#CFCFCF" fontFamily={fontFamily} fontSize="7.5" letterSpacing="2.2" textAnchor="middle">
      $TAKSIR · NEAR
    </text>
  </svg>
);

/** A slab of dark glass in CSS 3D. `rotY` 0 shows the spade, 180 shows Mr. X. */
const Card3D: React.FC<{ width: number; rotX: number; rotY: number; rotZ: number; accent: string; glow: number }> = ({
  width,
  rotX,
  rotY,
  rotZ,
  accent,
  glow,
}) => {
  const height = width * 1.4;
  const radius = (16 / 250) * width;
  const thick = width * 0.035;
  const face: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    borderRadius: radius,
    overflow: "hidden",
    backfaceVisibility: "hidden",
    backgroundColor: "#0b0b0e",
    boxShadow: `0 0 0 1.5px rgba(255,255,255,0.5), 0 0 ${Math.round(110 * glow)}px ${tint(accent, 85)}`,
  };
  // A band of light that crosses the glass as the card turns.
  const sheen: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundImage: "linear-gradient(105deg, transparent 38%, rgba(255,255,255,0.16) 50%, transparent 62%)",
    backgroundSize: "300% 100%",
    backgroundPosition: `${(((rotY % 180) + 180) % 180) / 1.8}% 0`,
  };
  const wash: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    backgroundImage: `radial-gradient(circle at 50% 28%, ${tint(accent, 26)} 0%, transparent 72%)`,
  };
  const edge: React.CSSProperties = { position: "absolute", backgroundColor: tint(accent, 55), backgroundImage: "linear-gradient(rgba(255,255,255,0.5), rgba(255,255,255,0.5))" };
  return (
    <div style={{ width, height, perspective: width * 4 }}>
      <div style={{ position: "relative", width: "100%", height: "100%", transformStyle: "preserve-3d", transform: `rotateX(${rotX}deg) rotateY(${rotY}deg) rotateZ(${rotZ}deg)` }}>
        <div style={{ ...face, transform: `translateZ(${thick / 2}px)` }}>
          <SpadeFace />
          <div style={wash} />
          <div style={sheen} />
        </div>
        <div style={{ ...face, transform: `rotateY(180deg) translateZ(${thick / 2}px)` }}>
          {/* Black ink on paper, inverted: the engraving becomes light in the glass, as on the site. */}
          <Img src={mrxArt} style={{ display: "block", width: "100%", height: "100%", filter: "invert(1) contrast(1.15)" }} />
          <div style={wash} />
          <div style={sheen} />
        </div>
        {[-1, 1].map((side) => (
          <div key={`x${side}`} style={{ ...edge, top: radius, height: height - 2 * radius, left: "50%", width: thick, marginLeft: -thick / 2, transform: `translateX(${(side * width) / 2}px) rotateY(90deg)` }} />
        ))}
        {[-1, 1].map((side) => (
          <div key={`y${side}`} style={{ ...edge, left: radius, width: width - 2 * radius, top: "50%", height: thick, marginTop: -thick / 2, transform: `translateY(${(side * height) / 2}px) rotateX(90deg)` }} />
        ))}
      </div>
    </div>
  );
};

/** The card through the whole intro: where it is, which side it shows, what light it catches. */
const HeroCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const turn = (from: number, to: number, degrees: number) => interpolate(frame, [from, to], [0, degrees], { ...CLAMP, easing: IN_OUT });
  const bell = (from: number, to: number) => interpolate(frame, [from, (from + to) / 2, to], [0, 1, 0], CLAMP);

  const rotY =
    -26 +
    interpolate(frame, [0, durationInFrames], [0, 24]) + // a slow drift under everything
    turn(118, 152, 200) + // spade → Mr. X
    turn(MECHANIC + ASK_1, MECHANIC + ASK_1 + TURN, 360) + // first ask
    turn(MECHANIC + ASK_2, MECHANIC + ASK_2 + TURN, 360) + // second ask
    turn(LOCKUP + 4, LOCKUP + 36, 174); // Mr. X → spade
  const rotX = 5 * Math.sin((frame / 150) * 2 * Math.PI);
  const rotZ = 1.5 * Math.sin((frame / 190) * 2 * Math.PI + 1);
  const bob = 12 * Math.sin((frame / 120) * 2 * Math.PI);

  const keys = [MECHANIC - 12, MECHANIC + 18, LOCKUP, LOCKUP + 32];
  const x = interpolate(frame, keys, [1470, 960, 960, 960], { ...CLAMP, easing: IN_OUT });
  const restY = interpolate(frame, keys, [468, 420, 420, 292], { ...CLAMP, easing: IN_OUT });
  const width = interpolate(frame, keys, [430, 260, 260, 220], { ...CLAMP, easing: IN_OUT });
  const height = width * 1.4;
  const y = restY + bob + interpolate(frame, [0, 40], [50, 0], { ...CLAMP, easing: OUT });

  const accent = interpolateColors(
    frame,
    [0, 118, 152, MECHANIC + STAMP - 4, MECHANIC + STAMP + 2, LOCKUP + 4, LOCKUP + 36],
    [INDIGO, INDIGO, BLUE, BLUE, MAGENTA, MAGENTA, "#ffffff"],
  );
  const glow = 0.75 + 0.7 * (bell(118, 152) + bell(MECHANIC + ASK_1, MECHANIC + ASK_1 + TURN) + bell(MECHANIC + ASK_2, MECHANIC + ASK_2 + TURN)) + 0.5 * bell(MECHANIC + STAMP, MECHANIC + STAMP + 24);
  const appear = interpolate(frame, [0, 24], [0, 1], CLAMP);
  const mirror = interpolate(frame, [MECHANIC - 20, MECHANIC], [0.34, 0], CLAMP);
  const card = <Card3D width={width} rotX={rotX} rotY={rotY} rotZ={rotZ} accent={accent} glow={glow} />;

  return (
    <>
      {/* The pool of light on the water under the card. */}
      <div
        style={{
          position: "absolute",
          left: x - 560,
          top: restY + height / 2 + 30,
          width: 1120,
          height: 260,
          backgroundImage: `radial-gradient(ellipse at center, ${tint(accent, 42)} 0%, transparent 68%)`,
          filter: "blur(26px)",
          opacity: appear * interpolate(frame, [MECHANIC - 20, MECHANIC], [1, 0.45], CLAMP),
        }}
      />
      <div
        style={{
          position: "absolute",
          left: x - width / 2,
          top: y - height / 2,
          opacity: appear * mirror,
          transform: `translateY(${height + 96 - 2 * bob}px) scaleY(-1)`,
          filter: "blur(4px)",
          maskImage: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 78%)",
          WebkitMaskImage: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, transparent 78%)",
        }}
      >
        {card}
      </div>
      <div style={{ position: "absolute", left: x - width / 2, top: y - height / 2, opacity: appear }}>{card}</div>
    </>
  );
};

// ── Atmosphere ──────────────────────────────────────────────────────────────────────────────────────

const Embers: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill>
      {Array.from({ length: 46 }, (_, i) => {
        const speed = 0.25 + random(`ember-speed-${i}`) * 0.7;
        const size = 1.5 + random(`ember-size-${i}`) * 2.5;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: random(`ember-x-${i}`) * 1920 + 14 * Math.sin(frame / 50 + i),
              top: 1090 - ((random(`ember-y-${i}`) * 1140 + frame * speed) % 1140),
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: "#fff",
              opacity: 0.12 + 0.3 * (0.5 + 0.5 * Math.sin(frame / 18 + i * 1.7)),
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** The camera: a slow push-in while the card is the subject, and a shake with a flash when the stamp hits. */
const Camera: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const frame = useCurrentFrame();
  const hit = MECHANIC + STAMP + 6;
  const power = frame < hit ? 0 : Math.exp(-(frame - hit) / 3.5);
  return (
    <AbsoluteFill
      style={{
        scale: interpolate(frame, [0, MECHANIC - 12, MECHANIC + 18], [1, 1.04, 1], { ...CLAMP, easing: Easing.inOut(Easing.sin) }),
        translate: `${9 * power * Math.sin(frame * 2.3)}px ${7 * power * Math.cos(frame * 2.9)}px`,
      }}
    >
      {children}
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: 0.16 * power }} />
    </AbsoluteFill>
  );
};

// ── Type ────────────────────────────────────────────────────────────────────────────────────────────

/** Words that rise in one after another from frame `at`, and leave together as their Sequence ends. */
const Words: React.FC<{ text: string; at: number; step?: number; stay?: boolean; style?: React.CSSProperties }> = ({ text, at, step = 3, stay = false, style }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <div style={{ ...style, opacity: stay ? 1 : interpolate(frame, [durationInFrames - 9, durationInFrames], [1, 0], CLAMP) }}>
      {text.split(" ").map((word, i) => (
        <span
          key={i}
          style={{
            display: "inline-block",
            marginRight: "0.3em",
            opacity: interpolate(frame, [at + i * step, at + i * step + 9], [0, 1], CLAMP),
            translate: interpolate(frame, [at + i * step, at + i * step + 18], ["0px 34px", "0px 0px"], { ...CLAMP, easing: OUT }),
            filter: `blur(${interpolate(frame, [at + i * step, at + i * step + 9], [9, 0], CLAMP)}px)`,
          }}
        >
          {word}
        </span>
      ))}
    </div>
  );
};

const KICKER: React.CSSProperties = { fontSize: 24, letterSpacing: "0.2em", color: "rgba(255,255,255,0.62)" };
const HEADLINE: React.CSSProperties = { fontSize: 74, fontWeight: 700, lineHeight: 1.08, textTransform: "uppercase", whiteSpace: "nowrap" };

/** The left column of the first two beats: a kicker, two big lines, and optional smaller lines. */
const Statement: React.FC<{ kicker: string; lines: [string, string]; strike?: number; sub?: string[] }> = ({ kicker, lines, strike, sub = [] }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ left: 150, width: 1100, justifyContent: "center", gap: 26 }}>
      <Words text={kicker} at={6} step={2} style={KICKER} />
      <div>
        <Words text={lines[0]} at={12} style={HEADLINE} />
        <div style={{ position: "relative", width: "fit-content" }}>
          <Words text={lines[1]} at={22} style={HEADLINE} />
          {strike === undefined ? null : (
            <div
              style={{
                position: "absolute",
                left: -10,
                right: 6,
                top: "50%",
                height: 7,
                backgroundColor: "#fff",
                transformOrigin: "left center",
                scale: `${interpolate(frame, [strike, strike + 12], [0, 1], { ...CLAMP, easing: IN_OUT })} 1`,
                opacity: interpolate(frame, [111, 120], [1, 0], CLAMP),
              }}
            />
          )}
        </div>
      </div>
      {sub.map((line, i) => (
        <Words key={line} text={line} at={56 + i * 30} step={2} style={{ fontSize: 34, lineHeight: 1.35, color: "rgba(255,255,255,0.82)", marginTop: i ? -14 : 8 }} />
      ))}
    </AbsoluteFill>
  );
};

// ── The mechanic, as a diagram ──────────────────────────────────────────────────────────────────────

/** Seven lines, as in case #3. In step 2 they trade places: the same lines, in reverse order. */
const BARS = [0.78, 0.52, 0.66, 0.44, 0.9, 0.58, 0.72];
const ROW = 44;
const PANEL: React.CSSProperties = { position: "absolute", border: "1px solid rgba(255,255,255,0.28)", backgroundColor: "rgba(255,255,255,0.035)", boxSizing: "border-box" };
const LABEL: React.CSSProperties = { fontSize: 20, letterSpacing: "0.18em", color: "rgba(255,255,255,0.6)" };

const ListPanel: React.FC = () => {
  const frame = useCurrentFrame();
  const middle = (BARS.length - 1) / 2;
  return (
    <div style={{ ...PANEL, left: 170, top: 228, width: 470, height: 414, padding: "28px 32px", opacity: interpolate(frame, [0, 12], [0, 1], CLAMP) }}>
      <div style={LABEL}>{frame < STEPS.sidak + 2 ? "ANY LIST OF TEXT LINES" : "SAME LINES, NEW ORDER"}</div>
      <div style={{ position: "relative", marginTop: 24, height: ROW * BARS.length }}>
        {BARS.map((_, i) => (
          <div key={`n${i}`} style={{ position: "absolute", left: 0, top: i * ROW + 7, fontFamily: MONO, fontSize: 19, color: "rgba(255,255,255,0.45)" }}>
            {i + 1}
          </div>
        ))}
        {BARS.map((share, i) => {
          const moved = interpolate(frame, [STEPS.sidak + 3 + i * 2, STEPS.sidak + 23 + i * 2], [0, 1], { ...CLAMP, easing: IN_OUT });
          const swing = Math.sin(Math.PI * moved) * (i < middle ? 36 : i > middle ? -36 : 0);
          return (
            <div
              key={`b${i}`}
              style={{
                position: "absolute",
                left: 46 + swing,
                top: (i + (BARS.length - 1 - 2 * i) * moved) * ROW + 11,
                width: share * 330,
                height: 16,
                borderRadius: 2,
                backgroundColor: "#fff",
                opacity: interpolate(frame, [4 + i * 3, 14 + i * 3], [0, 0.95 - i * 0.075], CLAMP),
              }}
            />
          );
        })}
      </div>
    </div>
  );
};

/** A wire with a light running along it each time the list is sent, or an answer comes back. */
const Wire: React.FC<{ left: number; width: number; pulses: number[] }> = ({ left, width, pulses }) => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left, top: 429, width, height: 2, backgroundColor: "rgba(255,255,255,0.22)", opacity: interpolate(frame, [6, 18], [0, 1], CLAMP) }}>
      {pulses.map((start) => (
        <div
          key={start}
          style={{
            position: "absolute",
            top: -5,
            left: interpolate(frame, [start, start + 12], [0, width - 12], CLAMP),
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: "#fff",
            boxShadow: "0 0 18px #fff",
            opacity: interpolate(frame, [start, start + 2, start + 10, start + 12], [0, 1, 1, 0], CLAMP),
          }}
        />
      ))}
    </div>
  );
};

/** Mr. X's two answers for case #3 on testnet: 10,000, then 1 for the same lines reversed. */
const Prices: React.FC = () => {
  const frame = useCurrentFrame();
  const figure: React.CSSProperties = { fontSize: 104, fontWeight: 700, lineHeight: 1, marginTop: 8, fontVariantNumeric: "tabular-nums" };
  const first = Math.round(interpolate(frame, [ASK_1 + TURN - 8, ASK_1 + TURN + 10], [1, 10000], { ...CLAMP, easing: OUT }));
  const second = Math.round(interpolate(frame, [ASK_2 + TURN - 8, ASK_2 + TURN + 10], [10000, 1], { ...CLAMP, easing: OUT }));
  const landed = frame - STAMP;
  return (
    <div style={{ position: "absolute", left: 1250, top: 235, width: 560 }}>
      <div style={{ opacity: interpolate(frame, [ASK_1 + TURN - 12, ASK_1 + TURN - 2], [0, 1], CLAMP) }}>
        <div style={LABEL}>FIRST ASK</div>
        <div style={figure}>{first.toLocaleString("en")}</div>
      </div>
      <div style={{ marginTop: 34, opacity: interpolate(frame, [ASK_2 + TURN - 12, ASK_2 + TURN - 2], [0, 1], CLAMP) }}>
        <div style={LABEL}>SAME LINES, REVERSED</div>
        <div style={figure}>{second.toLocaleString("en")}</div>
      </div>
      <div
        style={{
          position: "absolute",
          left: 196,
          top: 204,
          padding: "6px 26px 8px",
          border: "5px solid #fff",
          backgroundColor: tint(MAGENTA, 30),
          boxShadow: `0 0 70px ${MAGENTA}`,
          fontSize: 58,
          fontWeight: 700,
          letterSpacing: "0.06em",
          opacity: interpolate(landed, [0, 3], [0, 1], CLAMP),
          scale: interpolate(landed, [0, 6], [2.7, 1], { ...CLAMP, easing: Easing.in(Easing.cubic) }),
          rotate: `${-7 + (landed > 6 ? 1.6 * Math.exp(-(landed - 6) / 4) * Math.sin((landed - 6) * 1.9) : 0)}deg`,
        }}
      >
        BUSTED
      </div>
      <div style={{ marginTop: 30, opacity: interpolate(landed, [10, 20], [0, 1], CLAMP), translate: interpolate(landed, [10, 26], ["0px 18px", "0px 0px"], { ...CLAMP, easing: OUT }) }}>
        <div style={{ fontSize: 36, fontWeight: 700, color: GREEN }}>+50 $TAKSIR</div>
        <div style={{ ...LABEL, fontSize: 18, marginTop: 10 }}>REAL CASE #3 · NEAR TESTNET</div>
      </div>
    </div>
  );
};

const STEP_LINE: React.CSSProperties = { fontSize: 52, fontWeight: 700, lineHeight: 1.18, textTransform: "uppercase", whiteSpace: "nowrap" };

const Step: React.FC<{ kicker: string; text: string; payoff?: string }> = ({ kicker, text, payoff }) => (
  <AbsoluteFill style={{ top: 716, height: 300, alignItems: "center", textAlign: "center" }}>
    <Words text={kicker} at={2} step={2} style={{ ...KICKER, marginBottom: 18 }} />
    <Words text={text} at={6} step={2} style={STEP_LINE} />
    {payoff ? <Words text={payoff} at={24} step={2} style={{ ...STEP_LINE, color: GREEN }} /> : null}
  </AbsoluteFill>
);

const Mechanic: React.FC = () => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <>
      <AbsoluteFill style={{ opacity: interpolate(frame, [durationInFrames - 10, durationInFrames], [1, 0], CLAMP) }}>
        <ListPanel />
        <Wire left={640} width={186} pulses={[ASK_1 - 8, ASK_2 - 4]} />
        <Wire left={1094} width={140} pulses={[ASK_1 + TURN - 10, ASK_2 + TURN - 10]} />
        <Prices />
      </AbsoluteFill>
      <Sequence name="Step 1: taksir" durationInFrames={STEPS.sidak}>
        <Step kicker="01 · TAKSIR" text="Mr. X prices any list, from 1 to 10,000." />
      </Sequence>
      <Sequence name="Step 2: sidak" from={STEPS.sidak} durationInFrames={STEPS.busted - STEPS.sidak}>
        <Step kicker="02 · SIDAK" text="Same lines, new order. Ask him again." />
      </Sequence>
      <Sequence name="Step 3: busted" from={STEPS.busted} durationInFrames={BEATS.mechanic - STEPS.busted}>
        <Step kicker="03 · BUSTED" text="Price moved more than 75%?" payoff="His treasury pays you." />
      </Sequence>
    </>
  );
};

// ── The lockup ──────────────────────────────────────────────────────────────────────────────────────

const Lockup: React.FC = () => {
  const frame = useCurrentFrame();
  const pillars = ["NO OWNER", "NO MINT", "EVERY FEE BURNED"];
  return (
    <AbsoluteFill style={{ top: 506, alignItems: "center", textAlign: "center" }}>
      <div style={{ display: "flex", gap: 44, fontSize: 26, letterSpacing: "0.22em", color: "rgba(255,255,255,0.78)" }}>
        {pillars.map((pillar, i) => (
          <div key={pillar} style={{ opacity: interpolate(frame, [8 + i * 13, 18 + i * 13], [0, 1], CLAMP), translate: interpolate(frame, [8 + i * 13, 26 + i * 13], ["0px 16px", "0px 0px"], { ...CLAMP, easing: OUT }) }}>
            {i ? <span style={{ marginRight: 44, color: "rgba(255,255,255,0.35)" }}>·</span> : null}
            {pillar}
          </div>
        ))}
      </div>
      <Words text="RUG THE AI," at={50} stay style={{ fontSize: 100, fontWeight: 700, lineHeight: 1.06, marginTop: 44 }} />
      <Words text="NOT THE HOLDERS." at={58} stay style={{ fontSize: 100, fontWeight: 700, lineHeight: 1.06 }} />
      <Words text="A MEMECOIN WITH A MECHANIC · LIVE ON NEAR TESTNET" at={78} step={1} stay style={{ ...KICKER, fontSize: 22, marginTop: 40 }} />
    </AbsoluteFill>
  );
};

// ── The intro ───────────────────────────────────────────────────────────────────────────────────────

/** `music` is only for the intro on its own (SpadeIntro); inside the demo, the demo plays the track. */
export const Intro: React.FC<{ music?: string }> = ({ music }) => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#000", fontFamily, color: "#fff" }}>
      <Camera>
        <Embers />
        <HeroCard />
        <AbsoluteFill style={{ backgroundImage: "radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(0,0,0,0.7) 100%)" }} />
        <Sequence name="Beat 1: memecoins rug holders" durationInFrames={BEATS.rug}>
          <Statement kicker="MEMECOINS, USUALLY" lines={["Most memecoins", "rug their holders."]} strike={92} />
        </Sequence>
        <Sequence name="Beat 2: here the holders rug the AI" from={BEATS.rug} durationInFrames={BEATS.mrx}>
          <Statement
            kicker="SPADE · $TAKSIR"
            lines={["Here, the holders", "rug the AI."]}
            sub={["Meet Mr. X: an AI appraiser sealed inside a TEE.", "Catch him bluffing, and his treasury pays you."]}
          />
        </Sequence>
        <Sequence name="Beat 3: the mechanic" from={MECHANIC} durationInFrames={BEATS.mechanic}>
          <Mechanic />
        </Sequence>
        <Sequence name="Beat 4: lockup" from={LOCKUP} durationInFrames={BEATS.lockup}>
          <Lockup />
        </Sequence>
      </Camera>
      {/* Each whoosh starts a few frames before the middle of a turn, where it is loudest. */}
      <Sfx name="Whoosh: the card shows Mr. X" file="whoosh" from={127} volume={0.55} />
      <Sfx name="Whoosh: first ask" file="whoosh" from={MECHANIC + ASK_1 + 7} volume={0.4} />
      <Sfx name="Whoosh: second ask" file="whoosh" from={MECHANIC + ASK_2 + 7} volume={0.4} />
      <Sfx name="Thud: busted" file="thud" from={MECHANIC + STAMP + 5} volume={0.6} />
      <Sfx name="Whoosh: back to the spade" file="whoosh" from={LOCKUP + 12} volume={0.45} />
      {music ? <Music src={music} /> : null}
    </AbsoluteFill>
  );
};
