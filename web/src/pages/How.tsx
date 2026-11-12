import { Link } from "react-router-dom";
import { taksir } from "../chain/format";
import type { Params, Stats } from "../chain/types";
import { useView } from "../hooks/useView";
import { GhostButton, PageTitle } from "../ui/bits";
import { VerdictDemo } from "../ui/VerdictDemo";

/** The values locked at launch (docs/TESTNET.md). Shown until, and if, the contract answers: the
 * explanation must never be blank because an RPC is down. */
const LAUNCH = {
  appraisal_fee: "50000000000000000000",
  challenge_stake: "25000000000000000000",
  reward_multiplier: 2,
  threshold_bps: 7500,
  max_challenges: 3,
  challenge_window_ms: 3600000,
};

function duration(ms: number): string {
  const hours = ms / 3_600_000;
  if (Number.isInteger(hours)) return hours === 1 ? "1 hour" : `${hours} hours`;
  return `${Math.round(ms / 60_000)} minutes`;
}

/** A whole-token figure, rounded (the epoch budget is 5 ppm of the treasury: 299.9985 reads as 300). */
function roundedTaksir(yocto: string): string {
  return Number((BigInt(yocto) + 5n * 10n ** 17n) / 10n ** 18n).toLocaleString("en");
}

const STRENGTHS = [
  {
    title: "SUPPLY ONLY GOES DOWN",
    typical: "Typical: a mint key, or a tax rule the team can change.",
    to: "/ledger",
    check: "CHECK THE LEDGER →",
  },
  {
    title: "NOBODY CAN CHANGE THE RULES",
    typical: "Typical: an owner key and settings the team can change later.",
    to: "/verify",
    check: "CHECK ON VERIFY →",
  },
  {
    title: "THE REWARD IS EARNED, NOT PRINTED",
    typical: "Typical: rewards paid from inflation or from a cut of every trade.",
    to: "/cases",
    check: "SEE BUSTED CASES →",
  },
  {
    title: "PROOF, NOT PROMISES",
    typical: "Typical: take the team's word for how the mechanic works.",
    to: "/cases",
    check: "OPEN A SIGNED ANSWER →",
  },
] as const;

export default function How() {
  const params = useView<Params>("get_params");
  const stats = useView<Stats>("get_stats");
  const p = { ...LAUNCH, ...(params.data ?? {}) };

  const fee = taksir(p.appraisal_fee, 0);
  const stake = taksir(p.challenge_stake, 0);
  const reward = taksir((BigInt(p.challenge_stake) * BigInt(p.reward_multiplier)).toString(), 0);
  const limit = p.threshold_bps / 100;
  const epochBudget = stats.data ? roundedTaksir(stats.data.budget) : null;
  const budget = epochBudget ? `a budget of ${epochBudget} $TAKSIR per epoch` : "a small fixed budget per epoch";
  // Staking `stake` to win `reward` on top of getting it back pays off above this share of tries.
  const oneIn = 1 + p.reward_multiplier;

  const body = [
    "There is no mint function. 100,000,000 $TAKSIR were created once, at launch. Every fee, every lost stake and every unused reward is burned, so the supply can only shrink.",
    "The code has no owner, no setters and no upgrade method. Fees, stakes and limits are fixed at launch, and Mr. X's code is pinned by its hash. The deploy key is deleted at the final lock; Verify shows the live count.",
    `Tokens leave the treasury only when Mr. X is shown to be inconsistent, and only up to ${budget}. Unused budget is burned. Farming your own data cannot turn a profit.`,
    "Mr. X runs inside a hardware-sealed enclave (a TEE). His code is pinned by hash and every answer is signed, so anyone can check them. You do not have to trust a dashboard.",
  ];

  return (
    <main className="page page--how">
      <PageTitle caption="02 / 07 — IN ONE MINUTE" title="HOW IT WORKS" />
      <p className="lead">
        Mr. X is an AI that puts a price on your list. SIDAK checks that he is consistent. If he is not, you are paid from
        the treasury, not by other holders.
      </p>

      <section className="section" aria-labelledby="get-title">
        <h2 id="get-title" className="caption">
          WHAT YOU GET
        </h2>
        <p className="lead">
          Think of a pawnshop appraiser. You bring an item and he names a value. A surprise inspector brings the same item in
          different wrapping: the value should not change. If it jumps, the appraiser is unreliable and the inspector is paid.
          Mr. X is the appraiser and SIDAK is the inspection. Spade is a bounty for finding where an AI is unreliable, paid in
          the coin and provable on-chain.
        </p>
        <ul className="cards cards--three">
          <li className="card">
            <h3>ASKER</h3>
            <p>{`You pay ${fee} $TAKSIR (burned) and about 0.05 NEAR. You get a price from 1 to 10,000 and one line on why, signed inside a TEE and stored on-chain for anyone to check.`}</p>
            <p className="card__note">Nothing uses the price yet: today it is an auditable record.</p>
          </li>
          <li className="card">
            <h3>HUNTER</h3>
            <p>{`You stake ${stake} $TAKSIR. Catch Mr. X and you get it back plus ${reward}. Miss and it is burned. You come out ahead only if you catch him more than 1 in ${oneIn} tries.`}</p>
            <p className="card__note">
              Shuffling an ordinary list rarely moves the price, so blind tries lose. Profit comes from spotting a list he can
              be fooled by, in someone else's case: farming your own data nets zero.
            </p>
          </li>
          <li className="card">
            <h3>HOLDER</h3>
            <p>Every fee and every lost stake is burned, so the more Mr. X is used, the smaller the supply.</p>
            <p className="card__note">No dividends and no staking: if nobody uses it, nothing burns.</p>
          </li>
        </ul>
        <p className="muted how__limits">
          {epochBudget
            ? `Rewards are shared by every hunter: about ${epochBudget} $TAKSIR in total each epoch. On testnet the coin has no cash value.`
            : "Rewards are shared by every hunter, from a small fixed budget each epoch. On testnet the coin has no cash value."}
        </p>
      </section>

      <section className="section" aria-labelledby="steps-title">
        <h2 id="steps-title" className="caption">
          THE THREE STEPS
        </h2>
        <ol className="steps" aria-label="The three steps">
          <li>
            <span className="steps__n">01</span>
            <h3>TAKSIR</h3>
            <p>Give Mr. X a list, one item per line. He answers with a price from 1 to 10,000 and one line on why.</p>
            <div className="chips">
              <span className="chip">{`COST ${fee} $TAKSIR · BURNED`}</span>
            </div>
          </li>
          <li>
            <span className="steps__n">02</span>
            <h3>SIDAK</h3>
            <p>
              {`Anyone can send the same lines in a new order, within ${duration(p.challenge_window_ms)} of the answer. The order changes nothing, so the price should not move. Mr. X cannot tell it is a check. Up to ${p.max_challenges} checks per case.`}
            </p>
            <div className="chips">
              <span className="chip">{`STAKE ${stake} $TAKSIR`}</span>
            </div>
          </li>
          <li>
            <span className="steps__n">03</span>
            <h3>VERDICT</h3>
            <p>{`The contract compares the two prices. More than ${limit}% apart is BUSTED; anything closer is HELD.`}</p>
            <div className="chips">
              <span className="chip">{`BUSTED: STAKE BACK + ${reward}`}</span>
              <span className="chip">HELD: STAKE BURNED</span>
            </div>
          </li>
        </ol>
      </section>

      <VerdictDemo stake={stake} reward={reward} thresholdBps={p.threshold_bps} />

      <section className="section" aria-labelledby="diff-title">
        <h2 id="diff-title" className="caption">
          WHY IT'S DIFFERENT
        </h2>
        <p className="muted">“Typical” means common patterns in memecoin mechanics, not any one project.</p>
        <ul className="cards">
          {STRENGTHS.map((s, i) => (
            <li key={s.title} className="card">
              <h3>{s.title}</h3>
              <p>{body[i]}</p>
              <p className="card__typical">{s.typical}</p>
              <Link to={s.to} className="link-quiet">
                {s.check}
              </Link>
            </li>
          ))}
        </ul>
        <p className="caption how__loop">MR. X CONSISTENT → THE SUPPLY SHRINKS. MR. X CAUGHT → THE TREASURY PAYS OUT.</p>
      </section>

      <p className="muted how__limits">
        STILL TRUE: this is a testnet demo, not audited. The price is a claim you can audit; it is not yet something you
        can trade on. Shuffling the lines is one kind of check, not the only one possible.
      </p>

      <div className="row">
        <GhostButton to="/taksir">GET A PRICE</GhostButton>
        <GhostButton to="/cases">CALL HIS BLUFF</GhostButton>
      </div>
    </main>
  );
}
