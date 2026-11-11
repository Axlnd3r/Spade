#!/usr/bin/env bash
# Deploys the TAKSIR contract to a fresh sub-account vN.spade-taksir.testnet
# with scripts/params.testnet.json, in one transaction signed by the contract
# account (`new` is #[private], D-12 item 11).
#
# Usage (Git Bash on Windows): bash scripts/deploy.sh <N>
#
# Testnet only. This script never deletes access keys: locking the contract
# (T-3) is a human step in S6.
set -euo pipefail

N="${1:?usage: bash scripts/deploy.sh <N>}"
[[ "$N" =~ ^[1-9][0-9]*$ ]] || { echo "N must be a positive integer" >&2; exit 2; }

PARENT="spade-taksir.testnet"
CONTRACT="v${N}.${PARENT}"
NEAR="${NEAR_EXE:-/c/Users/User/bin/near.exe}"
# Funds the new account; the code alone locks ~2.7 NEAR of storage.
INITIAL_NEAR="${INITIAL_NEAR:-5}"
RPC="https://rpc.testnet.near.org"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Git Bash may print either /c/Users/... or C:/Users/...
WSL_ROOT="$(printf '%s' "$ROOT" | sed -E 's#^/?([A-Za-z]):?/#/mnt/\L\1/#')"
WASM="$ROOT/dist/taksir.wasm"
EMPTY_CODE="11111111111111111111111111111111"

rpc() {
  curl -sS -X POST "$RPC" -H 'Content-Type: application/json' -d "$1"
}

# code_hash of an account, or empty when the account does not exist.
code_hash() {
  rpc "{\"jsonrpc\":\"2.0\",\"id\":\"d\",\"method\":\"query\",\"params\":{\"request_type\":\"view_account\",\"finality\":\"final\",\"account_id\":\"$1\"}}" |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const r=JSON.parse(s).result;process.stdout.write(r?r.code_hash:"")})'
}

# A view call's JSON result, pretty-printed.
view() {
  local args
  args="$(printf '%s' "$2" | base64 -w0)"
  rpc "{\"jsonrpc\":\"2.0\",\"id\":\"d\",\"method\":\"query\",\"params\":{\"request_type\":\"call_function\",\"finality\":\"final\",\"account_id\":\"$CONTRACT\",\"method_name\":\"$1\",\"args_base64\":\"$args\"}}" |
    node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);if(!j.result||!j.result.result){console.error(s);process.exit(1)}console.log(JSON.stringify(JSON.parse(Buffer.from(j.result.result).toString()),null,2))})'
}

existing="$(code_hash "$CONTRACT")"
if [[ -n "$existing" && "$existing" != "$EMPTY_CODE" ]]; then
  echo "$CONTRACT already holds a contract (code_hash $existing). Parameters cannot change: use N=$((N + 1))." >&2
  exit 1
fi

echo "== 1/4 build (WSL, cargo near)"
mkdir -p "$ROOT/dist"
# wsl.exe runs the command through one more shell, so only variables that exist before it starts
# (like $HOME) expand; none is defined inside the command.
MSYS_NO_PATHCONV=1 wsl.exe bash -lc "set -e; cd '$WSL_ROOT/contracts/taksir' && CARGO_TARGET_DIR=\$HOME/.cache/spade-target/taksir cargo near build non-reproducible-wasm && cp \$HOME/.cache/spade-target/taksir/near/taksir.wasm '$WSL_ROOT/dist/taksir.wasm'"
echo "taksir.wasm sha256: $(sha256sum "$WASM" | cut -d' ' -f1) ($(wc -c < "$WASM") bytes)"

ARGS="$(node -e 'console.log(JSON.stringify({ params: require(process.argv[1]) }))' "$ROOT/scripts/params.testnet.json")"

if [[ -z "$existing" ]]; then
  echo "== 2/4 create $CONTRACT ($INITIAL_NEAR NEAR from $PARENT)"
  "$NEAR" account create-account fund-myself "$CONTRACT" "$INITIAL_NEAR NEAR" autogenerate-new-keypair save-to-legacy-keychain \
    sign-as "$PARENT" network-config testnet sign-with-legacy-keychain send
else
  echo "== 2/4 $CONTRACT exists without code: reusing it"
fi

echo "== 3/4 deploy + new (signed by $CONTRACT)"
"$NEAR" contract deploy "$CONTRACT" use-file "$WASM" with-init-call new json-args "$ARGS" \
  prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config testnet sign-with-legacy-keychain send

echo "== 4/4 check"
view get_params '{}'
view get_stats '{}'
echo "ft_total_supply: $(view ft_total_supply '{}')"
