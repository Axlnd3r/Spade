import type React from "react";
import { Sequence, Series } from "remotion";
import { Backdrop, Caption, Footage, Jump, SignPanel } from "./parts";
import { WALLET_RUN } from "./walletOutput";

// The wallet clip (public/wallet.mp4, from capture/wallet.mjs) cut down to its moments. Cut points come from
// the event times the recorder wrote, so a new recording needs no hand-tuning. Every cut over a wait is marked.

const FPS = 30;
const ev = WALLET_RUN.events;

/** Seconds `from`–`to` of wallet.mp4 at `rate`; `zoom` towards `origin` for moments the eye should read. */
type Segment = { from: number; to: number; rate: number; zoom?: number; origin?: string };

const TAKSIR: Segment[] = [
  { from: ev.start + 3, to: ev["appraise:click"] + 0.7, rate: 2.5 },
  { from: ev["appraise:prompt"] - 0.45, to: ev["appraise:run"] - 0.3, rate: 1.25 },
  { from: ev["appraise:signed"] + 0.1, to: ev["appraise:result"] - 2.2, rate: 2 },
  { from: ev["appraise:result"] - 2.2, to: ev["appraise:result"] + 5.3, rate: 1, zoom: 1.35, origin: "6% 60%" },
];

const SIDAK: Segment[] = [
  { from: ev["case:open"] - 0.2, to: ev["sidak:prompt"] + 0.9, rate: 2 },
  { from: ev["sidak:signed"] + 0.2, to: ev["sidak:verdict"] - 1, rate: 2 },
  { from: ev["sidak:verdict"] - 1, to: ev["sidak:verdict"] + 5.9, rate: 1, zoom: 1.35, origin: "6% 70%" },
];

const length = (s: Segment) => Math.round(((s.to - s.from) * FPS) / s.rate);
const starts = (segs: Segment[]) => segs.map((_, i) => segs.slice(0, i).reduce((n, s) => n + length(s), 0));
const total = (segs: Segment[]) => segs.reduce((n, s) => n + length(s), 0);

/** Where second `t` of the recording lands in the cut, in frames. */
function at(segs: Segment[], t: number): number {
  const i = segs.findIndex((s) => t >= s.from && t <= s.to);
  if (i < 0) throw new Error(`second ${t} of wallet.mp4 is cut out`);
  return starts(segs)[i] + Math.round(((t - segs[i].from) * FPS) / segs[i].rate);
}

export const TAKSIR_FRAMES = total(TAKSIR);
export const SIDAK_FRAMES = total(SIDAK);

const Cut: React.FC<{ segs: Segment[] }> = ({ segs }) => (
  <Series>
    {segs.map((s, i) => (
      <Series.Sequence key={i} name={`Wallet ${s.from.toFixed(1)}–${s.to.toFixed(1)} s ×${s.rate}`} durationInFrames={length(s)}>
        <Footage name="Wallet clip" src="wallet.mp4" trimBefore={Math.round(s.from * FPS)} playbackRate={s.rate} zoom={s.zoom} origin={s.origin} />
      </Series.Sequence>
    ))}
  </Series>
);

/** The wallet's signing step: the command appears with the prompt, the CLI's answer after the cut. */
const Signing: React.FC<{ segs: Segment[]; label: "appraise" | "sidak"; cutAt: number }> = ({ segs, label, cutAt }) => {
  const run = WALLET_RUN.signed.find((s) => s.label === label)!;
  const from = Math.min(at(segs, ev[`${label}:prompt`]), cutAt - 40);
  const to = at(segs, ev[`${label}:verify`]) + 10;
  const waited = Math.round(ev[`${label}:signed`] - ev[`${label}:run`]);
  return (
    <>
      <Sequence name={`Sign panel: ${label}`} from={from} durationInFrames={to - from}>
        <SignPanel command={run.command} output={run.output.filter((l) => /Transaction ID|succeeded/.test(l))} outputFrom={cutAt - from} />
      </Sequence>
      <Sequence name="Cut marker" from={cutAt} durationInFrames={2 * FPS}>
        <Jump text={`${waited} SECONDS LATER`} />
      </Sequence>
    </>
  );
};

const { appraisal, challenge } = WALLET_RUN;
const apart = Math.round((Math.abs(challenge.price - appraisal.price) / appraisal.price) * 100);

export const TaksirScene: React.FC = () => {
  const answer = at(TAKSIR, ev["appraise:result"]) - 10;
  return (
    <Backdrop>
      <Cut segs={TAKSIR} />
      <Signing segs={TAKSIR} label="appraise" cutAt={starts(TAKSIR)[2]} />
      <Sequence name="Caption: taksir" durationInFrames={answer}>
        <Caption kicker="TAKSIR · REAL WALLET ON TESTNET" text="Pay 50 $TAKSIR, burned. A fresh account signs with the NEAR CLI wallet." />
      </Sequence>
      <Sequence name="Caption: the price" from={answer} durationInFrames={TAKSIR_FRAMES - answer}>
        <Caption
          kicker={`MR. X SAYS ${appraisal.price.toLocaleString("en")}`}
          text="Priced inside the TEE. The answer and the model's signature are stored on-chain."
        />
      </Sequence>
    </Backdrop>
  );
};

export const SidakScene: React.FC = () => {
  const verdict = at(SIDAK, ev["sidak:verdict"]) - 10;
  const held = challenge.status === "Survived";
  return (
    <Backdrop>
      <Cut segs={SIDAK} />
      <Signing segs={SIDAK} label="sidak" cutAt={starts(SIDAK)[1]} />
      <Sequence name="Caption: sidak" durationInFrames={verdict}>
        <Caption
          kicker="SIDAK · SAME LINES, REVERSED"
          text={`Stake 25 $TAKSIR and ask again. More than 75% away from ${appraisal.price.toLocaleString("en")} is BUSTED.`}
        />
      </Sequence>
      <Sequence name="Caption: verdict" from={verdict} durationInFrames={SIDAK_FRAMES - verdict}>
        <Caption
          kicker={`${held ? "HELD" : "BUSTED"} · ${appraisal.price.toLocaleString("en")} → ${challenge.price.toLocaleString("en")}`}
          text={
            held
              ? `${apart}% apart, within 75%. Mr. X held steady, so the stake burned.`
              : `${apart}% apart. The stake comes back plus 50 $TAKSIR from the treasury.`
          }
        />
      </Sequence>
    </Backdrop>
  );
};
