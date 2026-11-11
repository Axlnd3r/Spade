import { RpcError, view } from "./rpc";

afterEach(() => vi.unstubAllGlobals());

test("view_encodes_args_and_decodes_result", async () => {
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body));
    expect(body.params.request_type).toBe("call_function");
    expect(body.params.method_name).toBe("get_appraisal");
    expect(JSON.parse(atob(body.params.args_base64))).toEqual({ id: 3 });
    const bytes = [...new TextEncoder().encode(JSON.stringify({ id: 3 }))];
    return new Response(JSON.stringify({ result: { result: bytes } }));
  });
  vi.stubGlobal("fetch", fetchMock);
  expect(await view("get_appraisal", { id: 3 })).toEqual({ id: 3 });
});

test("view_throws_rpc_error", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: { message: "boom" } }))));
  await expect(view("get_stats")).rejects.toBeInstanceOf(RpcError);
});

test("view_fails_over_to_the_next_rpc", async () => {
  const bytes = [...new TextEncoder().encode("7")];
  const fetchMock = vi
    .fn()
    .mockRejectedValueOnce(new TypeError("Failed to fetch"))
    .mockResolvedValueOnce(new Response(JSON.stringify({ result: { result: bytes } })));
  vi.stubGlobal("fetch", fetchMock);
  expect(await view("get_count")).toBe(7);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[0][0]).not.toBe(fetchMock.mock.calls[1][0]);
});
