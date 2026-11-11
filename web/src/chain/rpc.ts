import { CONTRACT_ID, RPC_URL } from "./config";

export class RpcError extends Error {}

async function query<T>(params: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "spade",
        method: "query",
        params: { finality: "optimistic", ...params },
      }),
    });
  } catch (e) {
    throw new RpcError(`network: ${(e as Error).message}`);
  }
  const body = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }));
  if (body.error) throw new RpcError(body.error.message ?? JSON.stringify(body.error));
  if (body.result?.error) throw new RpcError(String(body.result.error));
  return body.result as T;
}

function toBase64(s: string): string {
  return btoa(String.fromCharCode(...new TextEncoder().encode(s)));
}

/** A view call on the TAKSIR contract (or `contract`); the decoded JSON result. */
export async function view<T>(method: string, args: object = {}, contract: string = CONTRACT_ID): Promise<T> {
  const r = await query<{ result: number[] }>({
    request_type: "call_function",
    account_id: contract,
    method_name: method,
    args_base64: toBase64(JSON.stringify(args)),
  });
  return JSON.parse(new TextDecoder().decode(new Uint8Array(r.result))) as T;
}

export function viewAccount(id: string): Promise<{ amount: string; code_hash: string; storage_usage: number }> {
  return query({ request_type: "view_account", account_id: id });
}

export async function accessKeyCount(id: string): Promise<number> {
  const r = await query<{ keys: unknown[] }>({ request_type: "view_access_key_list", account_id: id });
  return r.keys.length;
}
