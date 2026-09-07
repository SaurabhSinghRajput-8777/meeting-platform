import path from "path";
import { defineConfig } from "@playwright/test";

/**
 * End-to-end WebRTC verification with real Chromium pages and fake media
 * devices. The backend and frontend servers are started automatically
 * (or reused if already running).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  retries: 0,
  workers: 1,
  use: {
    baseURL: "http://localhost:3000",
    headless: true,
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: [
        "--use-fake-ui-for-media-stream",
        "--use-fake-device-for-media-stream",
        "--auto-select-desktop-capture-source=Entire screen",
        "--autoplay-policy=no-user-gesture-required",
      ],
    },
  },
  webServer: [
    {
      command:
        process.platform === "win32"
          ? ".venv\\Scripts\\python.exe -m uvicorn app.main:app --port 8000"
          : ".venv/bin/python -m uvicorn app.main:app --port 8000",
      cwd: path.resolve(__dirname, "..", "backend"),
      url: "http://localhost:8000/api/v1/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "npm run dev",
      cwd: __dirname,
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
