import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Glossary } from "../ui/bits";

const step = (i: number) => ({ "--i": i }) as CSSProperties;

/** The first screen, in the manner of ohzi's: a title and a line at the top, Mr. X's card alone in the
 * middle (drawn by the stage behind this page), and one way in. */
export default function Landing() {
  return (
    <main className="landing">
      <div className="landing__head">
        <h1 className="landing__title stagger" style={step(0)}>
          RUG THE AI, NOT THE HOLDERS.
        </h1>
        <p className="landing__sub stagger" style={step(1)}>
          Mr. X is an AI sealed inside a TEE. Shuffle the lines, call his bluff.
        </p>
      </div>
      <div className="landing__foot">
        <Link to="/overview" className="glass-btn stagger" style={step(2)}>
          EXPLORE
        </Link>
        <div className="stagger" style={step(3)}>
          <Glossary />
        </div>
      </div>
    </main>
  );
}
