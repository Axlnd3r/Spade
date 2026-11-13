import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import type React from "react";
import { Sequence, useVideoConfig } from "remotion";
import { Backdrop, Caption, EndCard, Footage, Terminal, TitleCard } from "./parts";

export type DemoProps = {
  /** A clip in public/ recorded with a real wallet (docs/DEMO.md); empty uses the no-wallet TAKSIR footage. */
  walletClip: string;
};

/** Scene lengths in seconds, in order; 9 cross-fades of 12 frames overlap them. */
export const SCENE_SECONDS = [3, 13, 10, 13, 10, 13.5, 6, 9.5, 8, 6];
export const FADE_FRAMES = 12;

export const Demo: React.FC<DemoProps> = ({ walletClip }) => {
  const { fps } = useVideoConfig();
  return (
    <Backdrop>
      <TransitionSeries name="Scenes">
        <TransitionSeries.Sequence name="Title" durationInFrames={3 * fps}>
          <TitleCard />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="Landing" durationInFrames={13 * fps}>
          <Backdrop>
            <Footage name="Landing footage" src="footage/landing.mp4" trimBefore={1 * fps} playbackRate={1} />
            <Sequence name="Caption: Mr. X" durationInFrames={6.5 * fps}>
              <Caption kicker="MEET MR. X" text="An AI sealed inside a TEE. He puts a price from 1 to 10,000 on any list." />
            </Sequence>
            <Sequence name="Caption: the mechanic" from={6.5 * fps} durationInFrames={6.5 * fps}>
              <Caption kicker="THE MECHANIC" text="SIDAK: send the same lines in a new order. The price should not move." />
            </Sequence>
          </Backdrop>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="Taksir" durationInFrames={10 * fps}>
          <Backdrop>
            {walletClip ? (
              <Footage name="Wallet clip" src={walletClip} trimBefore={0} playbackRate={1} />
            ) : (
              <Footage name="Taksir footage" src="footage/taksir.mp4" trimBefore={1 * fps} playbackRate={1.3} zoom={1.45} origin="8% 55%" />
            )}
            <Caption kicker="TAKSIR · ASK FOR A PRICE" text="Pay 50 $TAKSIR, burned. Mr. X answers with a signed price, stored on-chain." />
          </Backdrop>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="Verdict" durationInFrames={13 * fps}>
          <Backdrop>
            <Footage name="Verdict footage" src="footage/verdict.mp4" trimBefore={5.5 * fps} playbackRate={1.3} zoom={1.5} origin="10% 62%" />
            <Sequence name="Caption: held" durationInFrames={8 * fps}>
              <Caption kicker="SIDAK · STAKE 25 $TAKSIR" text="Prices within 75% of each other: HELD. The stake is burned." />
            </Sequence>
            <Sequence name="Caption: busted" from={8 * fps} durationInFrames={5 * fps}>
              <Caption kicker="BUSTED" text="More than 75% apart: stake back plus 50 $TAKSIR from the treasury." />
            </Sequence>
          </Backdrop>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="Case 3" durationInFrames={10 * fps}>
          <Backdrop>
            <Footage name="Case 3 footage" src="footage/case3.mp4" trimBefore={0.5 * fps} playbackRate={1.25} zoom={1.35} origin="6% 30%" />
            <Sequence name="Caption: fooled" durationInFrames={5 * fps}>
              <Caption kicker="CASE #3 · NEAR TESTNET" text="10,000 for the list, then 1 for the same lines reversed. BUSTED." />
            </Sequence>
            <Sequence name="Caption: busted on-chain" from={5 * fps} durationInFrames={5 * fps}>
              <Caption kicker="THE CAUSE" text="A hidden note at the end of the list. The model's signature is stored on-chain." />
            </Sequence>
          </Backdrop>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="Menu and ledger" durationInFrames={13.5 * fps}>
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

        <TransitionSeries.Sequence name="Overview" durationInFrames={6 * fps}>
          <Backdrop>
            <Footage name="Overview footage" src="footage/overview.mp4" trimBefore={0.5 * fps} playbackRate={1.2} zoom={1.3} origin="5% 70%" />
            <Caption kicker="LIVE FROM TESTNET" text="100,000,000 $TAKSIR minted once, at launch. 42,210 burned so far." />
          </Backdrop>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="Verify" durationInFrames={9.5 * fps}>
          <Backdrop>
            <Footage name="Verify footage" src="footage/verify.mp4" trimBefore={0.5 * fps} playbackRate={1.2} zoom={1.45} origin="6% 40%" />
            <Caption kicker="DON'T TRUST THIS VIDEO" text="The contract's code and Mr. X's code are both pinned by hash." />
          </Backdrop>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="Terminal" durationInFrames={8 * fps}>
          <Backdrop>
            <Terminal />
            <Caption kicker="ONE COMMAND, READ-ONLY" text="Check every claim against the live chain yourself." />
          </Backdrop>
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_FRAMES })} />

        <TransitionSeries.Sequence name="End" durationInFrames={6 * fps}>
          <EndCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </Backdrop>
  );
};
