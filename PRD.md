# Training Atlas: Naman's fitness coaching micro-app

**Status:** product brief and first static React/Recharts build, 27 September 2026. Prepared for Claude review the following morning. This is Naman's own health/training dashboard, not a wearable-derived medical product. The app has real plotted workout data and a separate, prominently labeled illustrative sample mode for missing sleep/energy data. GitHub Pages publication and recurring check-in automations are separate work streams; do not describe either as complete until verified.

## 1. The problem and the outcome

Naman wants to become someone who trains consistently. His first priority is **consistency**; faster 5Ks come second. He wants check-ins that do not rely on memory or willpower, a positive feedback loop that shows how strong and energetic he actually is, and weekly/monthly evidence that training adds up. Recovery observations should protect the habit rather than reward one hard workout followed by a long interruption. After a month, the dashboard and report should make the amount of exercise obvious at a glance.

His key questions:
- Can he shorten the time between 5K runs from six days toward three without feeling worse afterward?
- Is 5K pace improving, and how does faster pace relate to fatigue the next morning and in the following days?
- How often does he sleep well and wake feeling energetic? What happened after workouts?
- When was his last workout, and is he meeting three workout days as orange or four-plus workout days as the green goal each seven-day week?

Success is not a streak fabricated from silence. Missing answers remain unknown. A rest day is logged as rest only when he reports it.

## 2. What is actually known at launch

These facts came directly from Naman's 27 September account of his training:

| Date, 2026 | Reported activity | Measurement | Notes |
|---|---|---|---|
| Sep 19 | First 5K run | Untimed | With Dia |
| Sep 25 | Second 5K run | 30 minutes, 6:00/km | Six days after the first |
| Sep 25 | Triceps session | Duration not given | Separate session record |
| Sep 26 | Biceps session | Duration not given | Separate session record |
| Sep 26 | Incline walk | 15% incline, 20 minutes | General health |

In the Sep 21-27 sample week, four activity records fall on two known active days. The prior week contains one *reported* run, not a complete training history. There are no reported sleep-quality, morning-energy, soreness, next-day fatigue or rest-day ratings. The single timed 5K is a baseline. **Pace improvement percentage is undefined until there is a second timed 5K.** Do not assert that he slept well, felt DOMS, recovered poorly, or became more consistent between these two incompletely logged weeks. DOMS can be mentioned as a possibility, not a diagnosis.

## 3. Inputs and cadence

### 9:30 AM every morning, approved
Ask for **last night's sleep quality 1–10** and **this morning's energy 1–10** together in one short check-in. Log the calendar date, both answers, and optionally hours slept if offered. The morning energy question is also his low-friction post-workout tiredness signal. If useful, ask about soreness 1–10 only after a recent workout; it is optional, not a fabricated metric.

### 6:00 PM every three days, approved
Prompt for the workout ledger: any 5K with elapsed time and perceived exertion if available; incline grade and minutes; biceps/triceps or other strength work; explicit rest days; and how he felt afterward. Record reported workouts promptly when he mentions them between prompts, rather than waiting for the next three-day slot. Anchor the first three-day cycle when automation is actually set up and tell him its first prompt date. Do not duplicate a session if he mentions it twice.

### Sunday visual report, requested
He wants a Sunday report with weekly progression and a monthly reveal. **7:00 PM was only proposed**, not reaffirmed in the latest timing message; main should settle it before scheduling. Report visual comparisons only for comparable observed periods, and label sample size and missingness. A month-end view includes total 5Ks, known kilometers, incline minutes, strength sessions, active dates, explicitly reported rest days, run intervals, timed pace changes, good-sleep and energetic-morning counts, and the fatigue/readiness relationship when sufficient data exists.

### Superseded request
An earlier separate 8:00 PM evening body check was in the initial proposal. Naman's latest cadence specifies the combined morning check and the three-day workout prompt; do **not** schedule the separate evening check without a fresh choice.

## 4. Data model and calculations

The canonical public app dataset is `data.json` in the GitHub repository. One row per workout or morning check-in, append-only in normal use. A separately held private Google Sheet in Naman's `bmnpeach` account is a backup/agent editing surface and is **not currently wired to the GitHub app**. Keeping both in sync requires an explicit update workflow; a write to the Sheet alone will not update the public app.

Suggested record fields:

| Field | Meaning |
|---|---|
| `date` | ISO local date (Asia/Kolkata), never UTC-shift a morning to the previous day |
| `type` | `morning`, `workout`, or explicitly reported `rest` |
| `sleep` | Subjective sleep quality 1–10; null if unknown |
| `energy` | Subjective morning energy 1–10; null if unknown |
| `soreness` | Optional next-morning soreness 1–10; null if not asked/answered |
| `workout` | 5K run, incline walk, biceps, triceps, or future categories |
| `minutes` | Workout duration; null when not timed |
| `distance` | Kilometers, 5 for a reported 5K |
| `incline` | Grade percentage for incline walking |
| `effort` | Optional perceived workout effort 1–10 |
| `notes`, `source`, `logged_at` | Optional context and provenance for audit/deduplication |

The first build implements the shared fields (`date`, `type`, `sleep`, `energy`, `soreness`, `workout`, `minutes`, `distance`, `incline`); the Sheet also has effort, hours slept, evening body, source, and notes. Next iteration should keep schema and migration rules in one place instead of allowing drift.

**Calculations:**
- Good-sleep days: quality **7/10 or better**, count only days with an answer; show `good / days in view` and `rated days` separately. The user specified green at 7+. Orange 5–6 and red 1–4 are current design proposals, not thresholds he explicitly approved. Missing = gray, never red.
- Energetic mornings: count days when energy **7/10 or better** (working design threshold; confirm if he prefers another cutoff). Show rated-days denominator and trend, not a wellness diagnosis.
- Exercise: **4 or more distinct workout days in a seven-day week = green; exactly 3 = orange; fewer than 3 = red.** Count a date only once, even when there are multiple activities. Treat unreported days as unknown, not proof of rest. This is the user's explicitly specified target coloring, not a claim that missing days were sedentary. For 28-day views, show distinct active days and weekly breakdowns rather than grading a 28-day total against a seven-day threshold.
- 5K pace: elapsed minutes divided by 5 km, displayed as min/km. For two timed runs, improvement percent = `(first timed pace − latest timed pace) / first timed pace × 100`; positive means faster. Alternatively show time improvement percent, but label the chosen basis. Do not compare an untimed run to a timed one.
- Run interval: calendar-day difference between successive 5K dates, displayed with six-day initial interval and three-day aspiration, without implying a three-day interval is medically ideal.
- Last-workout recency: last recorded workout date relative to viewing date. Do not freeze copy such as "yesterday" in a static dataset; compute dynamically.
- Post-workout tiredness: relate a run/workout date to energy and optional soreness on following mornings. If no ratings exist, chart gaps and say why. Avoid causal claims from sparse subjective data.
- Readiness: approved **train / easy / rest** nudges based on his own recent sleep, energy, soreness and workout recency, expressed as gentle suggestions. Do not counterfeit WHOOP/Apple physiological scores or diagnose illness. If severe/persistent pain appears, advise appropriate clinical assessment.

## 5. The product surface he asked for

This is a **real toggleable micro-app**, not an essay, not another Instinct-hosted page. GitHub Pages hosts the built app under `robertmuse6`; the repo's `data.json` is public for now by his explicit choice on Sep 27. Naman may later move to private hosting with authenticated access. Simply making a Pages repository private does not by itself make an already published public Pages site private; review hosting/access before doing that.

The first screen should be a concise evidence-based summary followed immediately by visually substantial charts and infographics. Show the last workout and four prominent metrics: good-sleep days, energetic-morning days, workout days out of seven relative to orange 3/green 4+ thresholds, and 5K pace-change percent or clearly marked unavailable. A weekly/28-day toggle and previous-period control change the charts. An interactive day detail reveals actual entries. Charts in the initial build:
1. Two-series sleep-quality and morning-energy area plot on a 1–10 scale, with gaps for unknown and a 7/10 reference line.
2. “How consistent you’ve been with exercise”: workout-day bars with a binary 0/1 mark per date, plus days since last workout and the average gap between distinct reported workout dates within the selected view. Unreported days remain unknown.
3. “Tracking my 5K pace”: timed 5K pace line, showing a single baseline point until a second comparable run. Naman asked that the separate after-effect/soreness widget be removed; optional soreness may remain in day detail and future analysis, not as a standalone plot.

The current app also has a **Preview sample / Back to real data** toggle with unmistakably synthetic sleep, energy, and soreness values only to demonstrate what the charts will look like. The real five workout rows stay real in both views. The default is actual data from the public repo. Never mix illustrative values into `data.json` or a report as if they were reported.

### Visual and interaction direction
- Take compositional cues from [WHOOP trends](https://www.whoop.com/us/en/thelocker/track-progress-with-new-trend-views/), [Fitbit / Google Health](https://support.google.com/fitbit/answer/14236725), and [Apple Health's redesigned Insights](https://www.apple.com/newsroom/2026/09/apple-advances-health-and-fitness-capabilities-using-apple-intelligence/): a decisive daily summary, legible trends, and drilldowns, but no copied scores or branding.
- Inspect actual [21st.dev Weekly Fitness Card](https://21st.dev/@shadcnspace/components/card-12), [Mobbin fitness gallery](https://mobbin.com/explore/mobile/app-categories/health-fitness), and a [Dribbble dashboard example](https://dribbble.com/shots/27677050-Elevate-Fitness-Activity-Tracking-Dashboard). Use layouts/prompts as inspiration; do not blindly copy third-party code or assets without checking license and fit.
- Consult the [UI/UX Pro Max design-system reference](https://github.com/nextlevelbuilder/ui-ux-pro-max-skill/blob/main/.claude/skills/design-system/SKILL.md) for token hierarchy, states, spacing and accessible components. Naman explicitly cited this as the quality bar.
- Mobile-first: readable at 390px; desktop grid at 1280px; chart tooltip and keyboard reachability; source date and sample/real status always visible. Prefer charts and short labels over long explanation. Green/orange/red/gray states must always have text labels too.

## 6. Architecture and publication

- App: React, TypeScript, Vite, Recharts SVG plots and Lucide icons. The build is a **single-route static bundle**, no BrowserRouter and no deep-link 404 issue on Pages. `vite.config.ts` uses relative assets. Publisher should deploy the contents of `dist/` at the repo root, including `data.json` and the `assets/` directory.
- Read path: fetch repo-hosted `data.json` with `no-store`; a new committed data file updates the app on reload. Static Pages propagation/caching may delay it. No server process is needed to view charts.
- Write path: connected agent collects Naman's messages and appends verified reported entries to the Sheet and then updates `data.json` in the repo through an authenticated publishing route. This latter automation is **not built yet**. The app itself is read-only. A local CSV import can preview Sheet exports in memory, without uploading them.
- Privacy: public repo and Pages intentionally expose every row in `data.json` to anyone, not merely "unlisted" visitors. Do not put credentials, API keys, private messages, contacts, or unrelated health records in the repo. The separate Sheet remains private unless intentionally shared.
- Source package: `src/`, `index.html`, `vite.config.ts`, `package.json`, `package-lock.json`, `public/data.json`, `README.md`, this PRD. `node_modules/` excluded. Built package: `dist/index.html`, `dist/data.json`, `dist/assets/*`.

## 7. Acceptance tests for the next reviewer

1. Open the deployed Pages URL on desktop and phone; check actual pixels for clipped plots, labels, selected buttons and mobile scroll. Verify all assets and `data.json` return, not just HTTP 200 on a soft-404.
2. Initial mode labels itself public real repo data; Sep 19 untimed and Sep 25 timed 5K, Sep 25 triceps, Sep 26 biceps and incline all appear; no invented sleep/energy/soreness scores. Two reported workout days out of seven count in Sep 21–27 week (Sep 25 and Sep 26), so the seven-day goal tile is red under the user's new rule; four individual activity records are still stored but not scored as four sessions. Pace percent unavailable.
3. Sample toggle clearly labels synthetic subjective scores; 7/28-day and previous-period controls update all charts; reload restores real data. Day drilldown and tooltips work on mouse and touch, with a keyboard-equivalent detail route or selection control added if needed.
4. Append a test morning answer to a private staging dataset: quality 7 and energy 8 produce one green sleep and one energetic morning, not seven. Clear it before public deployment. Check next-day association after a workout.
5. Add a second timed 5K to a staging dataset and verify percent calculation; refuse to compute from the untimed run. Check zero/invalid duration handling and duplicate workout suppression.
6. Confirm no secrets in committed source or compiled JS; repo and Sheet ownership correct; Pages visibility matches the explicit public-data decision.

## 8. Open decisions and future work

- Confirm Sunday report time (7 PM was proposed). The morning 9:30 and every-three-day 6 PM timings, Google Sheet use, and train/easy/rest nudges are approved. Do not revive the separate evening check by default.
- Decide whether orange/red sleep cutoffs and energetic-morning 7+ threshold feel right to Naman; only sleep-green 7+ and exercise targets were explicitly specified.
- Establish a reliable, permission-scoped repo data-update pipeline after each report. The existing private Sheet can serve as backup, but public repo data currently requires a separate update. Reconcile versions to avoid drift; the agent must check for duplicate rows and preserve provenance.
- Add a clear 7-day and rolling 28-day visual report export, monthly cumulative totals, run-gap chart and pace-versus-next-day-energy scatterplot when enough data exists. A week-on-week delta requires observed weeks with sufficiently complete records. Weekly goals score distinct workout days, never the count of separate activity rows.
- Ask whether he wants the app itself to accept new entries. Public GitHub Pages cannot securely mutate a repo using a client-embedded token. Keep writes with the agent or introduce a secure authenticated backend, never an anonymous endpoint.
- Optional: migrate to private authenticated hosting when he is ready. Reassess repo Pages and fork/clone history exposure rather than assuming flipping a visibility switch retracts public data.
