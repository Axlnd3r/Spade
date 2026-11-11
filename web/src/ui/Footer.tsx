import { CONTRACT_ID, EXPLORER } from "../chain/config";
import { Glossary } from "./bits";

export function Footer() {
  return (
    <footer className="footer">
      <Glossary />
      <p className="caption">
        NEAR TESTNET ·{" "}
        <a href={`${EXPLORER}/address/${CONTRACT_ID}`} target="_blank" rel="noreferrer">
          {CONTRACT_ID} ↗
        </a>{" "}
        ·{" "}
        <a href="https://github.com/Axlnd3r/Spade" target="_blank" rel="noreferrer">
          SOURCE ↗
        </a>
      </p>
    </footer>
  );
}
