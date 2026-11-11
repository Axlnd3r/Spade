import { NearConnector } from "@hot-labs/near-connect";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { CONTRACT_ID, GAS, NETWORK } from "../chain/config";

type Wallet = Awaited<ReturnType<NearConnector["connect"]>>;

export interface WalletApi {
  accountId: string | null;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
  /** One FunctionCall on the TAKSIR contract with 300 TGas; throws on rejection or a failed outcome. */
  call(method: string, args: object, depositYocto: string): Promise<{ txHash: string }>;
}

const readOnly: WalletApi = {
  accountId: null,
  signIn: async () => {},
  signOut: async () => {},
  call: async () => {
    throw new Error("Connect a wallet first.");
  },
};

export const WalletContext = createContext<WalletApi>(readOnly);

export function useWallet(): WalletApi {
  return useContext(WalletContext);
}

type Outcome = { transaction?: { hash?: string }; status?: { Failure?: unknown } };

/** NEAR Connect (`@hot-labs/near-connect`), the wallet library NEAR docs recommend; testnet only. */
export function WalletProvider({ children }: { children: ReactNode }) {
  const connector = useMemo(() => new NearConnector({ network: NETWORK }), []);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);

  useEffect(() => {
    connector
      .getConnectedWallet()
      .then(({ wallet, accounts }) => {
        setWallet(wallet);
        setAccountId(accounts[0]?.accountId ?? null);
      })
      .catch(() => {});
    connector.on("wallet:signIn", async (t) => {
      setWallet(await connector.wallet());
      setAccountId(t.accounts[0]?.accountId ?? null);
    });
    connector.on("wallet:signOut", () => {
      setWallet(null);
      setAccountId(null);
    });
  }, [connector]);

  const signIn = useCallback(async () => {
    const w = await connector.connect();
    const accounts = await w.getAccounts();
    setWallet(w);
    setAccountId(accounts[0]?.accountId ?? null);
  }, [connector]);

  const signOut = useCallback(async () => {
    if (wallet) await connector.disconnect(wallet);
    setWallet(null);
    setAccountId(null);
  }, [connector, wallet]);

  const call = useCallback(
    async (method: string, args: object, depositYocto: string) => {
      if (!wallet) throw new Error("Connect a wallet first.");
      const outcome = (await wallet.signAndSendTransaction({
        receiverId: CONTRACT_ID,
        actions: [{ type: "FunctionCall", params: { methodName: method, args, gas: GAS, deposit: depositYocto } }],
      })) as unknown as Outcome;
      if (outcome?.status?.Failure) throw new Error(JSON.stringify(outcome.status.Failure));
      return { txHash: outcome?.transaction?.hash ?? "" };
    },
    [wallet],
  );

  const api = useMemo(() => ({ accountId, signIn, signOut, call }), [accountId, signIn, signOut, call]);
  return <WalletContext.Provider value={api}>{children}</WalletContext.Provider>;
}
