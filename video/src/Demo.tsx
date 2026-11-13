import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type React from "react";
import { Sequence, useVideoConfig } from "remotion";
import { Intro, INTRO_FRAMES } from "./Intro";
import { Backdrop, Caption, EndCard, Footage, Terminal } from "./parts";
import { Music } from "./sound";
import { SIDAK_FRAMES, SidakScene, TAKSIR_FRAMES, TaksirScene } from "./WalletScenes";

export type DemoProps = {
  /** The background track in public/ (docs/DEMO.md); empty renders the video without it. */
  music: string;
};

const FPS = 30;

/** Scene lengths in seconds, in order; a 12-frame cross-fade overlaps each pair. */
const SECONDS = {
  intro: INTRO_FRAMES / FPS,
  landing: 9,
  verdict: 13,
  taksir: TAKSIR_FRAMES / FPS,
  sidak: SIDAK_FRAMES / FPS,
  case3: 10,
  menu: 13.5,
  overview: 6,
  verify: 9.5,
  terminal: 8,
  end: 6.5,
};
export const FADE_FRAMES = 12;
export const TOTAL_FRAMES = Object.values(SECONDS).reduce((sum, s) => sum + Math.round(s * FPS), 0) - (Object.keys(SECONDS).length - 1) * FADE_FRAMES;

export const Demo: React.FC<DemoProps> = ({ music }) => {
  const { fps } = useVideoConfig();
  return (
    <Backdrop>
      {music ? <Music src={music} /> : null}
      <TransitionSeries name="Scenes">
        <TransitionSeries.Sequence name="Intro" durationInFrames={INTRO_FRAMES}>
          <Intro />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="Landing" durationInFrames={SECONDS.landing * fps}>
          <Backdrop>
            <Footage name="Landing footage" src="footage/landing.mp4" trimBefore={7.2 * fps} playbackRate={1} />
            <Sequence name="Caption: live site" durationInFrames={5 * fps}>
              <Caption kicker="NOT A MOCKUP" text="Everything from here on is the live site, running on NEAR testnet." />
            </Sequence>
            <Sequence name="Caption: three ways in" from={5 * fps} durationInFrames={4 * fps}>
              <Caption kicker="THREE WAYS IN" text="Ask for a price. Hunt for a bluff. Or just hold while the supply burns." />
            </Sequence>
          </Backdrop>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="Verdict" durationInFrames={SECONDS.verdict * fps}>
          <Backdrop>
            <Footage name="Verdict footage" src="footage/verdict.mp4" trimBefore={5.5 * fps} playbackRate={1.3} zoom={1.5} origin="10% 62%" />
            <Sequence name="Caption: held" durationInFrames={8 * fps}>
              <Caption kicker="THE RULE · STAKE 25 $TAKSIR" text="Two prices within 75% of each other: HELD. Your stake is burned." />
            </Sequence>
            <Sequence name="Caption: busted" from={8 * fps} durationInFrames={5 * fps}>
              <Caption kicker="BUSTED" text="More than 75% apart: your stake back, plus 50 $TAKSIR from the treasury." />
            </Sequence>
          </Backdrop>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="Taksir with a wallet" durationInFrames={TAKSIR_FRAMES}>
          <TaksirScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="Sidak with a wallet" durationInFrames={SIDAK_FRAMES}>
          <SidakScene />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="Case 3" durationInFrames={SECONDS.case3 * fps}>
          <Backdrop>
            <Footage name="Case 3 footage" src="footage/case3.mp4" trimBefore={0.5 * fps} playbackRate={1.25} zoom={1.35} origin="6% 30%" />
            <Sequence name="Caption: fooled" durationInFrames={5 * fps}>
              <Caption kicker="CASE #3 · NEAR TESTNET" text="10,000 for the list, then 1 for the same lines reversed. BUSTED." />
            </Sequence>
            <Sequence name="Caption: red-teaming as a game" from={5 * fps} durationInFrames={5 * fps}>
              <Caption kicker="AI RED-TEAMING, AS A GAME" text="The list hid a prompt injection. SIDAK caught it, and the proof is on-chain." />
            </Sequence>
          </Backdrop>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="Menu and ledger" durationInFrames={SECONDS.menu * fps}>
          <Backdrop>
            <Footage name="Menu footage" src="footage/menu.mp4" trimBefore={1 * fps} playbackRate={1.6} />
            <Sequence name="Caption: one contract" durationInFrames={9 * fps}>
              <Caption kicker="ONE CONTRACT" text="Every rule lives in one NEAR contract. No owner, no setters, no mint function." />
            </Sequence>
            <Sequence name="Caption: ledger" from={9 * fps} durationInFrames={4.5 * fps}>
              <Caption kicker="LEDGER" text="Every fee and every lost stake is burned. The supply can only go down." />
            </Sequence>
          </Backdrop>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="Overview" durationInFrames={SECONDS.overview * fps}>
          <Backdrop>
            <Footage name="Overview footage" src="footage/overview.mp4" trimBefore={0.5 * fps} playbackRate={1.2} zoom={1.3} origin="5% 70%" />
            <Caption kicker="LIVE FROM TESTNET" text="100,000,000 $TAKSIR minted once, at launch. The supply has only gone down since." />
          </Backdrop>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="Verify" durationInFrames={SECONDS.verify * fps}>
          <Backdrop>
            <Footage name="Verify footage" src="footage/verify.mp4" trimBefore={0.5 * fps} playbackRate={1.2} zoom={1.45} origin="6% 40%" />
            <Caption kicker="DON'T TRUST THIS VIDEO" text="The contract's code and Mr. X's code are both pinned by hash." />
          </Backdrop>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="Terminal" durationInFrames={SECONDS.terminal * fps}>
          <Backdrop>
            <Terminal />
            <Caption kicker="ONE COMMAND, READ-ONLY" text="Check every claim against the live chain yourself." />
          </Backdrop>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="End" durationInFrames={SECONDS.end * fps}>
          <EndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </Backdrop>
  );
};
