import { Link } from "react-router-dom";
import { useWallet } from "../wallet/WalletProvider";

export function SpadeMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size * 1.13} viewBox="-15 -15 30 34" aria-hidden="true">
      <path
        d="M0,-14 C5,-8 14,-3 14,4 C14,10 8,13 3,9 C3,12 4,15 7,17 L-7,17 C-4,15 -3,12 -3,9 C-8,13 -14,10 -14,4 C-14,-3 -5,-8 0,-14 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function Header({ onMenu }: { onMenu(): void }) {
  const { accountId, signIn, signOut } = useWallet();
  return (
    <header className="header">
      <Link to="/" className="header__lockup" aria-label="Spade home">
        <SpadeMark />
        <span className="lockup">SPADE · $TAKSIR</span>
      </Link>
      <div className="header__right">
        {accountId ? (
          <button type="button" className="header__account" onClick={signOut} title="Disconnect">
            {accountId}
          </button>
        ) : (
          <button type="button" className="header__account" onClick={signIn}>
            CONNECT WALLET
          </button>
        )}
        <button type="button" className="header__burger" aria-label="Open menu" onClick={onMenu}>
          <span />
          <span />
        </button>
      </div>
    </header>
  );
}
