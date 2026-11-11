export const NETWORK = "testnet" as const;
export const CONTRACT_ID = "v2.spade-taksir.testnet";
export const RPC_URL = "https://rpc.testnet.near.org";
export const EXPLORER = "https://testnet.nearblocks.io";

/** Enclave pinned in the contract params (S3, docs/TESTNET.md). */
export const WASM_HASH = "0206187e1ba0c53acb5c5e991b1d559c20eafb01d617a387be5a0848c7348ee2";
export const RELEASE_WASM_URL = "https://github.com/Axlnd3r/Spade/releases/download/enclave-v1/appraiser.wasm";

/** Contract code deployed to v2 (docs/TESTNET.md): bs58 code_hash and sha256 hex of taksir.wasm. */
export const CONTRACT_CODE_HASH = "CMd9x3xLmM3dm9HDsxhZMz1Z4Etzcs3RgasvMnarWV4J";
export const CONTRACT_WASM_SHA256 = "a8b90d5a9d54ce1fb9085ee0e2980780acd8c8f4431d5ae2f92b5b7c0b6b0127";

export const GAS = "300000000000000";
export const FAUCET_DEPOSIT = "10000000000000000000000";
export const POLL_MS = 3000;
export const SOFT_TIMEOUT_MS = 90000;
export const STATS_REFRESH_MS = 10000;
