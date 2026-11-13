import { Audio } from "@remotion/media";
import type React from "react";
import { interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";

/** The background track (public/music.m4a, see docs/DEMO.md): in over one second, out over the last two. */
export const Music: React.FC<{ src: string }> = ({ src }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  return (
    <Audio
      name="Music"
      src={staticFile(src)}
      volume={interpolate(frame, [0, 1 * fps, durationInFrames - 2 * fps, durationInFrames], [0, 0.85, 0.85, 0], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      })}
    />
  );
};

/** One of the synthesized effects in public/sfx (capture/sfx.mjs), starting at frame `from`. */
export const Sfx: React.FC<{ name: string; file: "whoosh" | "thud"; from: number; volume: number }> = ({ name, file, from, volume }) => (
  <Audio name={name} from={from} src={staticFile(`sfx/${file}.wav`)} volume={volume} />
);
