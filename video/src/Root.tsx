import { Composition } from "remotion";
import { Demo, TOTAL_FRAMES } from "./Demo";
import { Intro, INTRO_FRAMES } from "./Intro";

const FPS = 30;
/** The track in public/ (docs/DEMO.md). Render with --props='{"music":""}' when the file is not there. */
const MUSIC = "music.m4a";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="SpadeDemo" component={Demo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{ music: MUSIC }} />
      {/* The opening on its own, for work on it and as a short teaser. */}
      <Composition id="SpadeIntro" component={Intro} durationInFrames={INTRO_FRAMES} fps={FPS} width={1920} height={1080} defaultProps={{ music: MUSIC }} />
    </>
  );
};
