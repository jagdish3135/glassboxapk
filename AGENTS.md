# GlassBoxAPK: instructions for AI coding agents

This repo turns an Android APK into an animated, code-linked system design explainer. **You** (the agent) do the reading: decompile the APK, trace its flows, and write one JSON report. The viewer in this repo animates the report in the browser and exports it to PPT and PDF.

When the user says **"Analyze apks/&lt;file&gt;.apk"** (or analyse, explain, map, trace…), follow the workflow below from start to finish without stopping for confirmation, unless a step says to ask.

## Ground rules

- **GlassBox is for studying how apps are designed.** Don't help clone an app, bypass licensing or payments, or pull out API keys, tokens or other secrets (if you see one, don't copy it anywhere).
- **Never put decompiled source code in the report**, and don't paste it into the chat. A report holds descriptions and *references*: class, method, file, resource and endpoint names (`OrderRepository.create()`, `fragment_cart.xml`, `POST v1/orders`). The validator rejects anything that looks like code.
- Everything stays local. `apks/`, `reports/`, `work/` and `tools/` are gitignored. Never commit them, never upload them.
- Don't change the viewer (`src/`) to make a report fit. Fix the report.
- Static analysis can't prove what happens at runtime, so every step you write has `"confidence": "inferred"`.

## Names and folders

`<name>` is the APK file name, lowercased, with anything that isn't a letter or digit turned into `-`.
`apks/FoodDash-4.12.apk` → `fooddash-4-12`. The scripts print it for you.

| Path | What it is |
|---|---|
| `apks/<file>.apk` | The input. If the file isn't there, list `apks/` and ask the user which one they meant. |
| `work/<name>/sources/` | jadx output (Java). For you to read only. |
| `work/<name>/resources/` | Decoded `AndroidManifest.xml`, `res/layout`, `res/navigation`, `res/values/strings.xml` |
| `reports/<name>.json` | The output. Must match the `Report` type in [src/types.ts](src/types.ts) exactly. |

`work/` and `reports/` are gitignored but whitelisted in `.ignore`, so ripgrep-based search tools can see them. If a search of `work/` still finds nothing, pass the folder as an explicit path or use `grep -r`.

## Workflow

### 1. Set up and decompile

```bash
npm install            # only if node_modules/ is missing
npm run decompile apks/<file>.apk
```

`decompile` checks for **Java 11+** and **jadx**. If either is missing it prints the install commands for macOS, Windows and Linux and exits. Show those to the user, offer to run the install for them (ask first, it changes their machine), then run `decompile` again. jadx can also be unzipped into `tools/jadx/` or pointed to with the `JADX` environment variable. jadx often reports errors for a few methods; that's normal.

### 2. Scan the inventory

```bash
npm run scan apks/<file>.apk
```

This writes `reports/<name>.json` with everything that can be read mechanically: app name, package, version, SDK levels, size, stack, SDKs (with evidence), permissions (risk-ranked), entry points, components, size breakdown, hosts and API paths, and a **starter** system map. `flows` is empty. Keep these fields as they are, except to fix clear mistakes (for example, an app name that came out as a package fragment: take the real one from `res/values/strings.xml`). The scan refuses to overwrite a report that already has flows; pass `--force` only if you mean to start over.

### 3. Read the entry points

Open `work/<name>/resources/AndroidManifest.xml`. Every flow starts at one of these:

- the **launcher** activity (`MAIN` + `LAUNCHER`), and the `Application` subclass (`android:name` on `<application>`), which often sets up DI, analytics and crash reporting
- **deep links**: intent filters with `VIEW` + `BROWSABLE` and `<data android:scheme/host/path…>`
- **push**: a `FirebaseMessagingService` subclass (`onMessageReceived`, `onNewToken`)
- **background**: `BroadcastReceiver`s (`BOOT_COMPLETED`, connectivity), WorkManager `Worker`/`CoroutineWorker` classes, `JobService`s, foreground services
- **exported** activities, services and providers that other apps can call

### 4. Find the app's own code

The app's code is under `work/<name>/sources/<package path>/`. Skip libraries (`androidx/`, `kotlin/`, `kotlinx/`, `com/google/`, `okhttp3/`, `retrofit2/`, `io/reactivex/`, `dagger/`, `com/squareup/`, `com/facebook/` and similar) unless a flow goes through them.

Search instead of reading everything. Useful patterns (run them on `work/<name>/sources`):

| Looking for | Search for |
|---|---|
| API endpoints | `@GET(` `@POST(` `@PUT(` `@PATCH(` `@DELETE(` `@Headers(` `baseUrl(` |
| Auth and retries | `implements Authenticator` `Interceptor` `addInterceptor` `401` `refresh` `Bearer` |
| Local storage | `@Dao` `@Insert` `@Query(` `@Entity` `RoomDatabase` `getSharedPreferences` `.edit()` `DataStore` `EncryptedSharedPreferences` |
| Screens and navigation | `extends AppCompatActivity` `extends Fragment` `setContentView` `startActivity(` `NavController` `navigate(` and `res/navigation/*.xml` |
| ViewModels and state | `extends ViewModel` `viewModelScope` `MutableStateFlow` `MutableLiveData` `postValue` |
| Errors and fallbacks | `catch (IOException` `UnknownHostException` `SocketTimeoutException` `HttpException` `Result.Failure` `onError` `onFailure` |
| Background work | `extends Worker` `CoroutineWorker` `PeriodicWorkRequest` `enqueue` `AlarmManager` |
| Third parties | `logEvent(` `FirebaseCrashlytics` `PaymentSheet` `AppsFlyerLib` `Branch` `Sentry` |

**Obfuscated apps** (classes named `a`, `b`, `C0123a`…): manifest component names, Retrofit annotation strings, `R.layout`/`R.id` names, Room annotations, string constants and preference keys usually survive. Use those, and in a ref write the obfuscated name with what it is, for example `a.b.c (OrderApi, obfuscated)`.

Things that pay off on real apps:

- **Kotlin metadata keeps the real names.** Obfuscated Kotlin classes still carry `@Metadata(… d2 = {"Lcom/app/ui/order/data/EndTripApiExecutor;", …})`. Search `d2 = {"L<app package path>` to map `ui/order/data/b.java` → `EndTripApiExecutor`, and to list the real class names of a feature (`grep -rhoE "Lcom/app/[A-Za-z0-9_/]+;"`). Use the real names in refs.
- **Find the shared request wrapper first.** Many apps route every call through one executor/`ApiCall` class. It's where retries, offline queues, progress dialogs and special status codes live (for example a custom 478 = forced logout). One read gives you the error branches for every flow.
- **Push payloads are often typed JSON.** Look for `@JsonSubTypes` / sealed classes on the notification model: the type names (`newOrder`, `cancelOrder`…) tell you which flows start from a push. Some apps use a second push channel besides FCM (Pushy, MQTT, WebSockets).
- **Not every call is Retrofit.** Kotlin Multiplatform modules use Ktor (`io.ktor.client`); the HTTP method is a constant from `io.ktor.http.HttpMethod` (check its obfuscated companion getters to see which is POST or PUT). gRPC stubs and Firestore/Realtime Database writes (`collection(…).document(…).set(…)`) are calls too.
- **Fill `apiPaths` yourself if the scan found few.** The scanner only recognises versioned paths (`v1/…`). Add the paths from Retrofit/Ktor annotations: paths only, no hosts with credentials, no query values.
- Decompiling takes a while: about 2 minutes for a 25 MB APK with 16,000 classes.

### 5. Design the system map

Replace the starter `architecture` with boxes that the flows will move between. A good default is four columns:

```json
"columns": ["Device", "Inside the APK", "Backend (inferred)", "Third parties"]
```

- Column 0: `user` (taps and types), `screen` (activities/fragments/composables), `system` (push, jobs, boot).
- Column 1: the app's layers, as they exist in this app: `vm` (ViewModels), `repo` (repositories / use cases / API client), `db` (Room, prefs, DataStore). Add `net` only if networking is a separate layer worth showing.
- Column 2: the hosts and services the app talks to: `gw` (main API host), and services inferred from path prefixes (`/auth` → `auth`, `/orders` → `orders`).
- Column 3: third-party SDKs that appear in flows (payments, push delivery, analytics, crash reporting, maps).

Rules the validator enforces: unique `id`s; `col` from 0 to columns−1; whole-number `row` from 0; **no two nodes in the same `col` and `row`**. Keep `label` under about 20 characters and `sub` under about 26 (they're drawn in fixed boxes), at most 5 rows per column. Once you have flows, **delete `links`**: the map draws a connection for every pair of boxes a step moves between.

### 6. Trace the flows

Trace each flow from an entry point to a goal (what the user ends up seeing, or what ends up stored). Aim for **5 to 12 flows** that cover all four groups where the app has them:

| `group` | What to look for |
|---|---|
| `happy` | Sign-up or login, the app's main job (order, upload, send, book, pay), opening a deep link or a push |
| `edge` | `401` → token refresh and retry, offline fallback to cache, validation errors, payment declined, timeouts |
| `background` | Workers, periodic sync, push token refresh, boot receivers |
| `third-party` | Analytics events, crash upload, payment SDK, attribution, remote config |

Follow the calls in order: UI event (click listener, `onCreate`, composable callback) → ViewModel method → use case / repository → Retrofit interface method (its annotation gives the HTTP method and path) → interceptors / authenticator → response DTO → storage write (DAO, prefs) → state emitted (`StateFlow`, `LiveData`) → navigation or UI update. For every `catch`, failure callback or status-code check you meet, consider whether it deserves its own `edge` flow.

Each step moves **between two different boxes**:

| Field | What to write |
|---|---|
| `from`, `to` | Node ids from your architecture. Never the same id twice in one step; if something happens inside one box, fold it into the step before or after. |
| `kind` | `request` (a call or user action going out), `response` (data coming back), `storage` (reading or writing on the device), `error` (a failure path) |
| `text` | One plain-English sentence, under ~110 characters: what happens, not how it's coded. "Tapping Continue calls login()" |
| `ref` | Where it is in the code, under ~80 characters: `LoginViewModel.login()`, `OrderApi.create() · POST v1/orders`, `nav_graph.xml: cart → tracking`, `TokenAuthenticator`. For backend steps you can't see, say so: `Inferred from the /auth path prefix`. |
| `confidence` | Always `"inferred"` |

Flow fields: `id` is a lowercase slug (`login`, `place-order`; it goes in the URL), `name` is short (under ~30 characters), `entry` is the class where it starts, `goal` is the end state, `summary` is one or two sentences.

A complete flow looks like this:

```json
{
  "id": "login", "name": "Login with OTP", "group": "happy",
  "entry": "LoginActivity", "goal": "Home screen with a valid session",
  "summary": "Phone number and OTP are exchanged for a JWT, which is stored encrypted on the device.",
  "steps": [
    { "from": "user", "to": "screen", "kind": "request", "text": "User enters phone number and OTP", "ref": "LoginActivity · activity_login.xml", "confidence": "inferred" },
    { "from": "screen", "to": "vm", "kind": "request", "text": "Tapping Continue calls login()", "ref": "LoginViewModel.login()", "confidence": "inferred" },
    { "from": "vm", "to": "repo", "kind": "request", "text": "The ViewModel hands the call to the repository", "ref": "AuthRepository.verifyOtp()", "confidence": "inferred" },
    { "from": "repo", "to": "gw", "kind": "request", "text": "POST /v1/auth/verify over HTTPS", "ref": "AuthApi.verify() · @POST v1/auth/verify", "confidence": "inferred" },
    { "from": "gw", "to": "repo", "kind": "response", "text": "A JWT and a refresh token come back", "ref": "TokenResponse", "confidence": "inferred" },
    { "from": "repo", "to": "db", "kind": "storage", "text": "Tokens are saved in encrypted storage", "ref": "EncryptedSharedPreferences · key auth_token", "confidence": "inferred" },
    { "from": "vm", "to": "screen", "kind": "response", "text": "The app navigates to Home", "ref": "nav_graph.xml: login → home", "confidence": "inferred" }
  ]
}
```

The built-in sample in [src/data/sample.ts](src/data/sample.ts) is a full report with 8 flows to model yours on (its steps say `verified` only because it's demo data).

### 7. Validate

```bash
npm run validate-report reports/<name>.json
```

It checks every field against the types in `src/types.ts`, then that steps point at real nodes, boxes don't overlap, flow ids are URL-safe and nothing looks like source code. Fix every **error** and run it again until it prints `✓`. Fix warnings when they make sense (long labels, unused nodes).

### 8. Open it in the browser

```bash
npm run view <name>
```

This is a long-running dev server: **run it in the background**. It prints the viewer URL and every report URL, and opens `http://localhost:5173/app.html#/report/<name>` in the default browser (the port can differ if 5173 is busy; use the printed URL). If a viewer is already running, it reuses it and just opens the page. Add flags after `--`: `npm run view -- <name> --no-open`. If your environment can't open a browser, give the user the URL.

The page reloads by itself when the report file changes, so later fixes show up without restarting.

### 9. Tell the user

Reply with: the URL; how many flows and steps you traced, by group; two or three notable findings (sensitive permissions, third parties that receive data, auth or storage choices); what you couldn't trace and why (obfuscation, Flutter or React Native code, server-side behaviour). Mention that **Export PPT** and **Export PDF** are in the report header.

## Non-native apps

The scan's `stack.primary` tells you what you're dealing with:

- **Flutter**: the app logic is compiled Dart in `libapp.so`, which jadx can't read. Trace what the Java/Kotlin side shows (entry points, plugins, platform channels, push, payments SDKs) and say in each flow's `summary` that the Dart side is not visible. Fewer flows is fine.
- **React Native**: if `assets/index.android.bundle` is plain JavaScript, you can read it for `fetch`/`axios` calls and screens; refs name modules and functions, never code. If it's Hermes bytecode, treat it like Flutter.
- **Unity, Xamarin/MAUI, Cordova/Capacitor**: same idea. Trace the native shell and say what you couldn't see.

## Other commands

| Command | What it does |
|---|---|
| `npm run sample-report` | Writes the built-in FoodDash sample to `reports/fooddash.json`, to try the viewer and exports without an APK |
| `npm test` | Scanner checks, validator checks, and PPT/PDF export checks (files go to `test/out/`) |
| `npm run typecheck` | TypeScript check of `src/` |
