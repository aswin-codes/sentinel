import path from "node:path";
import { existsSync } from "node:fs";

const envFile = path.resolve(__dirname, "../../.env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

async function main() {
  // Dynamic imports so DATABASE_URL is loaded before the pool is created.
  const { db, pool } = await import("./index");
  const { projects, testPlans } = await import("./schema");
  const { upsertPlan, ensureRun, setResult, getPlanFull } = await import("../lib/plans");
  const { eq, and } = await import("drizzle-orm");

  const T = {
    terminal: { label: "Terminal", color: "zinc" },
    admin: { label: "Admin panel", color: "amber" },
    phone: { label: "Phone", color: "sky" },
    claude: { label: "Claude sets up", color: "violet" },
  };

  let [project] = await db.select().from(projects).where(eq(projects.name, "Bombay Canvas"));
  if (!project) {
    [project] = await db
      .insert(projects)
      .values({
        name: "Bombay Canvas",
        description: "Streaming app — mobile client, backend and admin panel.",
        repoPath: process.cwd(),
      })
      .returning();
  }

  const { planId } = await upsertPlan({
    projectId: project.id,
    planTitle: "Push Notifications Test Plan",
    description:
      "Covers the automatic triggers, per-person time zones, quiet hours and the daily limit, the admin Notifications tab with broadcasts, and the app side. Run it on localhost first.",
    gitBranch: "feature/push-notifications",
    commitHash: "a1c9e42",
    status: "active",
    sections: [
      {
        code: "S",
        title: "Setup (do once)",
        description: "Run these before anything else. The tests below assume all of them are done.",
        cases: [
          {
            code: "S1",
            title: "Apply the database changes",
            tags: [T.terminal, T.claude],
            steps: ["Tell Claude to apply the two new migrations to the local database (supabase_local_1) only."],
            expected: [
              "Both `20261111120000_push_triggers` and `20261111130000_push_timezone_cap` are applied.",
              "No existing data changes.",
            ],
            agentPrompt:
              "Apply migrations 20261111120000_push_triggers and 20261111130000_push_timezone_cap to the local database supabase_local_1 only. Do not touch any other database. Report which migrations ran.",
          },
          {
            code: "S2",
            title: "Start the backend with push on",
            tags: [T.terminal],
            steps: ["Set `PUSH_ENABLED=true` in the backend `.env`.", "Restart the backend (`npm run dev`)."],
            expected: [
              "The log line `[CRON] … scheduled` lists push dispatch, push receipts, trial ending push, continue watching push and win back push.",
            ],
          },
          {
            code: "S3",
            title: "Prepare the phone",
            tags: [T.phone],
            steps: ["Reload the app.", "Sign in as the test user.", "Allow notifications when asked."],
            expected: ["Metro shows exactly one `POST /api/notifications/devices 200`."],
          },
          {
            code: "S4",
            title: "Turn on the three triggers that start off",
            tags: [T.admin],
            steps: [
              "Open the admin panel → Notifications tab.",
              "Switch on: New series in your languages and genres, Continue watching, Win back.",
            ],
            expected: ["All 9 triggers now show on."],
          },
        ],
      },
      {
        code: "A",
        title: "Admin: triggers and daily limit",
        cases: [
          {
            code: "A1",
            title: "Notifications tab loads",
            tags: [T.admin],
            steps: ["Open the admin panel.", "Click the Notifications tab (between Reviews and Settings)."],
            expected: [
              "Sections in order: Send a notification, Recent notifications, Daily limit, Automatic notifications.",
              "9 triggers, each with label, description, audience and a switch.",
              "The Settings tab has nothing notification-related.",
            ],
          },
          {
            code: "A2",
            title: "Turn a trigger off and on",
            tags: [T.admin],
            steps: ["Switch Upcoming series off.", "Refresh the page.", "Switch it back on."],
            expected: [
              "A toast confirms each change.",
              "The state survives the refresh.",
              "A “Changed by … on …” line appears under the trigger.",
            ],
          },
          {
            code: "A3",
            title: "Two switches at once",
            tags: [T.admin],
            steps: ["Quickly switch two different triggers off, one after the other.", "Switch both back on."],
            expected: ["Both rows end in the state you set; neither one flips back on its own."],
            agentPrompt:
              "In the admin Notifications tab, toggling two trigger switches quickly causes one to flip back. Find the race in the trigger toggle mutation (likely a stale cache overwrite from the first request's response) and fix it so concurrent toggles are independent.",
          },
          {
            code: "A4",
            title: "Daily limit rejects bad values",
            tags: [T.admin],
            steps: ["Try each value: empty, 0, 11, 2.5."],
            expected: [
              "Each shows an inline error (“Enter a number.”, “Pick a number from 1 to 10.”, “Use a whole number.”) and Save stays disabled.",
              "The saved value does not change.",
            ],
          },
        ],
      },
      {
        code: "B",
        title: "App: registration and time zone",
        cases: [
          {
            code: "B1",
            title: "Registers once, no 401 loop",
            tags: [T.phone],
            steps: ["Close and reopen the app, watching Metro."],
            expected: ["At most one `POST /api/notifications/devices`, status 200.", "No repeating 401s."],
          },
          {
            code: "B2",
            title: "Time zone is saved",
            tags: [T.phone, T.claude],
            steps: ["Ask Claude to read the device row."],
            expected: ["`PushDevice.timeZone` is `Asia/Kolkata`."],
            agentPrompt: "Query the PushDevice row for the test user in supabase_local_1 and report its timeZone.",
          },
          {
            code: "B3",
            title: "Time zone change re-registers",
            tags: [T.phone, T.claude],
            steps: [
              "Android Settings → Date & time: turn off automatic time zone and pick New York (America/New_York).",
              "Bring the app to the foreground.",
              "Ask Claude to read the device row, then switch automatic time zone back on.",
            ],
            expected: ["One new `POST /devices 200`.", "The row now shows `America/New_York`."],
          },
          {
            code: "B4",
            title: "Sign out detaches the phone",
            tags: [T.phone],
            steps: ["Sign out.", "Send a broadcast from admin.", "Sign back in."],
            expected: [
              "The phone receives nothing while signed out.",
              "After signing in, one registration and pushes resume.",
            ],
          },
        ],
      },
    ],
  });

  // Sample marks on the active run so the UI shows progress out of the box.
  const runId = await ensureRun(planId);
  const plan = await getPlanFull(planId, runId);
  const byCode = new Map(plan!.sections.flatMap((s) => s.cases).map((c) => [c.code, c.id]));
  const mark = (code: string, status: "pass" | "fail", notes?: string) =>
    setResult({ runId, caseId: byCode.get(code)!, status, notes });
  await mark("S1", "pass");
  await mark("S2", "pass");
  await mark("S3", "pass");
  await mark("A1", "pass");
  await mark("A3", "fail", "Second switch flipped back to ON about a second after toggling. Reproducible 3/3.");

  const [check] = await db
    .select()
    .from(testPlans)
    .where(and(eq(testPlans.projectId, project.id), eq(testPlans.title, "Push Notifications Test Plan")));
  console.log(`Seeded project #${project.id} "${project.name}", plan #${check.id}, run #${runId}.`);
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
