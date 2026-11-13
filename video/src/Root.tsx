import { Composition } from "remotion";
import { Demo, FADE_FRAMES, SCENE_SECONDS } from "./Demo";

const FPS = 30;

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="SpadeDemo"
      component={Demo}
      durationInFrames={SCENE_SECONDS.reduce((s, x) => s + x * FPS, 0) - (SCENE_SECONDS.length - 1) * FADE_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{ walletClip: "" }}
    />
  );
};
