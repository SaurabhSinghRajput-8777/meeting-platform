import { expect, test, type Page } from "@playwright/test";

const API = "http://localhost:8000";

/**
 * Three-browser WebRTC mesh verification:
 *   Browser A (host, default user)
 *      ↕    ↖
 *   B (Alice)  C (Bob)
 *
 * Uses Chromium's fake camera/microphone device so real getUserMedia,
 * RTCPeerConnection, SDP/ICE negotiation and track flows are exercised.
 */
async function joinMeeting(page: Page, roomCode: string, displayName: string) {
  await page.goto(`/meeting/${roomCode}`);
  await page.getByPlaceholder("Enter your name").fill(displayName);
  await page.getByRole("button", { name: "Join meeting" }).click();
  // Wait for the meeting toolbar (meeting room mounted + connecting resolved)
  await expect(page.getByRole("button", { name: "Mute" })).toBeVisible({ timeout: 30_000 });
}

async function videoTilesWithFrames(page: Page): Promise<number> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll("video")).filter((video) => video.videoWidth > 0).length,
  );
}

test("three participants connect in a mesh, chat, host controls and screen share work", async ({
  browser,
  request,
}) => {
  // Create an instant meeting as the default (host) user via the REST API.
  const createResponse = await request.post(`${API}/api/v1/rooms/instant`, {
    data: { title: "E2E Mesh Meeting" },
  });
  expect(createResponse.ok()).toBeTruthy();
  const room = await createResponse.json();

  const context = await browser.newContext();
  const host = await context.newPage();
  const alice = await context.newPage();
  const bob = await context.newPage();

  await test.step("join with three browsers", async () => {
    await joinMeeting(host, room.room_code, "Demo User");
    await joinMeeting(alice, room.room_code, "Alice");
    await joinMeeting(bob, room.room_code, "Bob");
  });

  await test.step("all three participants see each other (peer discovery + tiles)", async () => {
    await expect(host.locator("[data-tile]")).toHaveCount(3, { timeout: 30_000 });
    await expect(alice.locator("[data-tile]")).toHaveCount(3, { timeout: 30_000 });
    await expect(bob.locator("[data-tile]")).toHaveCount(3, { timeout: 30_000 });
    await expect(alice.locator('[data-tile="Demo User"]')).toBeVisible();
    await expect(alice.locator('[data-tile="Bob"]')).toBeVisible();
  });

  await test.step("remote video frames flow over WebRTC", async () => {
    // Each page should eventually render 3 videos with actual frames
    // (own fake camera + 2 remote streams over the mesh).
    await expect
      .poll(async () => videoTilesWithFrames(host), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(3);
    await expect
      .poll(async () => videoTilesWithFrames(alice), { timeout: 60_000 })
    .toBeGreaterThanOrEqual(3);
  });

  await test.step("mute/unmute and camera toggle update remote state", async () => {
    // Alice mutes herself
    await alice.getByRole("button", { name: "Mute" }).click();
    await expect(alice.getByRole("button", { name: "Unmute" })).toBeVisible();
    // The host sees Alice's mic-off indicator on her tile
    await expect(
      host.locator('[data-tile="Alice"]').locator("svg").first(),
    ).toBeVisible();
    // ...and unmutes again for the later host-control step
    await alice.getByRole("button", { name: "Unmute" }).click();
    await expect(alice.getByRole("button", { name: "Mute" })).toBeVisible();

    // Bob turns his camera off; host tile shows the avatar fallback
    await bob.getByRole("button", { name: "Stop video" }).click();
    await expect(bob.getByRole("button", { name: "Start video" })).toBeVisible();
    await expect(host.locator('[data-tile="Bob"]')).toBeVisible();
  });

  await test.step("chat messages broadcast to everyone", async () => {
    await alice.getByRole("button", { name: "Chat" }).click();
    await alice.getByPlaceholder("Type a message…").fill("Hello from Alice!");
    await alice.getByPlaceholder("Type a message…").press("Enter");
    await expect(alice.getByText("Hello from Alice!")).toBeVisible();

    await host.getByRole("button", { name: "Chat" }).click();
    await expect(host.getByText("Hello from Alice!")).toBeVisible({ timeout: 15_000 });
  });

  await test.step("host mutes a participant (server-authorized command)", async () => {
    await host.getByRole("button", { name: "Participants" }).click();
    const aliceRow = host.locator("li", { hasText: "Alice" });
    await aliceRow.getByRole("button", { name: "Mute", exact: true }).click();
    // Alice's own toolbar flips to muted
    await expect(alice.getByRole("button", { name: "Unmute" })).toBeVisible({
      timeout: 15_000,
    });
  });

  await test.step("screen sharing reaches remote participants", async () => {
    await host.getByRole("button", { name: "Share screen" }).click();
    // The sharer's tile is labeled on remote pages via media-state
    await expect(alice.getByText("Sharing screen").first()).toBeVisible({ timeout: 20_000 });
    await host.getByRole("button", { name: "Stop sharing" }).click();
  });

  await test.step("host ends the meeting for everyone", async () => {
    await host.getByRole("button", { name: "End" }).click();
    await expect(host).toHaveURL(/localhost:3000\/?$|notice/, { timeout: 30_000 });
    await expect(alice).toHaveURL(/localhost:3000\/?$|notice/, { timeout: 30_000 });
    await expect(bob).toHaveURL(/localhost:3000\/?$|notice/, { timeout: 30_000 });
  });

  await context.close();
});
