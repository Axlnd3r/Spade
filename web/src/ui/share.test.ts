import { shareUrl } from "./share";

test("share_url_is_an_x_intent", () => {
  expect(shareUrl("BUSTED! #NEARHackathon", "https://x/y")).toBe(
    "https://x.com/intent/post?text=BUSTED!%20%23NEARHackathon&url=https%3A%2F%2Fx%2Fy",
  );
});
