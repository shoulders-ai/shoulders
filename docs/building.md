# Building & Releasing

## Prerequisites

Bundling is enabled via `tauri.conf.json`:
```json
"bundle": {
  "active": true,
  "targets": "all"
}
```
Without `"active": true`, `tauri build` only produces a raw binary — no `.app`, `.dmg`, `.msi`, etc.

## Tectonic (LaTeX Compiler)

Tectonic is **not bundled** with the app. It is downloaded on demand by the user via Settings → System (~15MB one-time download from [tectonic GitHub releases](https://github.com/tectonic-typesetting/tectonic/releases)). The binary is saved to `~/.shoulders/bin/tectonic`.

This approach avoids macOS notarization issues with bundled dylibs and keeps the app bundle size small. See `docs/tex-system.md` for the full discovery order and download flow.

For **local development**, you can also use a system-wide install (`brew install tectonic`). The app checks system paths after `~/.shoulders/bin/`.

## Local Build

```bash
npx tauri build                    # unsigned build (fast, for testing)
npx tauri build --bundles app      # macOS .app only
npx tauri build --bundles dmg      # macOS .dmg installer
```

Output lands in `src-tauri/target/release/bundle/macos/`.

### Cross-compiling for Intel on Apple Silicon

```bash
rustup target add x86_64-apple-darwin  # one-time
npx tauri build --target x86_64-apple-darwin --bundles app
```

Output lands in `src-tauri/target/x86_64-apple-darwin/release/bundle/macos/`.

### OpenSSL gotcha

Cross-compiling for x86_64 on ARM requires that `reqwest` and `git2` use `default-features = false` in `Cargo.toml`. Without this, `openssl-sys` tries to find an x86_64 OpenSSL installation via `pkg-config` and fails. The current config uses `rustls-tls` (pure Rust) for reqwest and disables git2's default `https` feature, so no system OpenSSL is needed for any target.

## macOS Code Signing & Notarization

Without signing, macOS shows "app is damaged" when users download the app. Signing requires an Apple Developer account ($99/year) and a "Developer ID Application" certificate.

### Prerequisites

1. Apple Developer Program membership — developer.apple.com/programs
2. "Developer ID Application" certificate (G2 Sub-CA) — created in Certificates, Identifiers & Profiles
3. Certificate installed in Keychain Access (login keychain) — double-click the `.cer` file
4. App-specific password — generated at appleid.apple.com → App-Specific Passwords

### Signed + notarized local build

Create a `.env` file at the repo root (gitignored):
```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: <Your Name> (<TeamID>)"
export APPLE_ID="<your-apple-id>"
export APPLE_PASSWORD="<app-specific-password>"
export APPLE_TEAM_ID="<TeamID>"
```

Then build:
```bash
source .env && npx tauri build
```

Tauri automatically signs, notarizes (uploads to Apple for scanning), and staples the ticket. Notarization usually takes 2-5 minutes but can hang on first submissions.

### Manual notarization fallback

If Tauri's notarization hangs (known Apple issue — `notarytool --wait` sometimes gets stuck):

1. Build without Apple env vars: `npx tauri build`
2. Notarize and staple manually:
```bash
ditto -c -k --keepParent src-tauri/target/release/bundle/macos/Shoulders.app /tmp/Shoulders.zip
xcrun notarytool submit /tmp/Shoulders.zip \
  --apple-id "<your-apple-id>" \
  --password "<app-specific-password>" \
  --team-id "<TeamID>" \
  --wait
xcrun stapler staple src-tauri/target/release/bundle/macos/Shoulders.app
```

### Verifying

```bash
# Check signing identity (should show TeamIdentifier, NOT "adhoc")
codesign -dv src-tauri/target/release/bundle/macos/Shoulders.app

# Check Gatekeeper acceptance (should say "source=Notarized Developer ID")
spctl -a -vv src-tauri/target/release/bundle/macos/Shoulders.app
```

### Platform signing summary

| Platform | Required? | Cost | Without it |
|---|---|---|---|
| macOS | Yes | $99/year Apple Developer | "App is damaged" — users can't open it |
| Windows | Optional | $200-400/year for cert | SmartScreen "unknown publisher" warning (users can click through) |
| Linux | No | Free | No warnings |

## Documentation Search Index

The documentation site (`shoulde.rs/docs`) uses a custom, statically-generated search index to provide instant client-side search without relying on a backend API or third-party service like Algolia.

### How it works

1. The documentation pages are standard Vue components located in `web/components/docs/`.
2. A Node script (`web/scripts/generate-search.js`) parses these `.vue` files.
3. It extracts headings (`<h2>`, `<h3>`) and their associated paragraph/list content.
4. It compiles this into a structured JSON array and saves it to `web/public/search-index.json`.
5. The frontend `Search.vue` component fetches this JSON file and uses `fuse.js` for fast fuzzy searching.

### Updating the Index

Whenever you add, remove, or significantly modify documentation content in `web/components/docs/*.vue`, you must manually regenerate the search index:

```bash
cd web
node scripts/generate-search.js
```

This will overwrite the `search-index.json` file in the `public` directory. You should then commit the updated JSON file to version control.

**Why manual?** We explicitly chose *not* to hook this script into the CI/CD build pipeline (`bun run build`) to eliminate the risk of a regex parsing error breaking the production deployment. A static, manually updated index is bulletproof.

---

## CI/CD (GitHub Actions)

Workflow: `.github/workflows/build.yml`

### What happens automatically

| Trigger | Builds | Release? |
|---|---|---|
| Tag push (`v*`) | macOS ARM, macOS Intel, Linux, Windows | Yes — draft release created |
| Manual (`workflow_dispatch`) | macOS ARM, macOS Intel, Linux, Windows | No — artifacts only |

CI builds separate ARM and Intel bundles (not a universal binary). This keeps each download smaller and simplifies the build matrix.

### macOS signing in CI (not yet tested)

For macOS CI builds to be signed + notarized, 6 secrets must be configured in the GitHub repo (Settings → Secrets → Actions):

| Secret | How to get it |
|---|---|
| `APPLE_CERTIFICATE` | Export cert from Keychain Access as `.p12`, then `base64 -i cert.p12 \| pbcopy` |
| `APPLE_CERTIFICATE_PASSWORD` | Password chosen when exporting the `.p12` |
| `APPLE_SIGNING_IDENTITY` | `Developer ID Application: <Your Name> (<TeamID>)` |
| `APPLE_ID` | `<your-apple-id>` |
| `APPLE_PASSWORD` | App-specific password from appleid.apple.com |
| `APPLE_TEAM_ID` | `<TeamID>` |

The `tauri-apps/tauri-action` automatically installs the certificate and handles signing + notarization when these env vars are present. The workflow passes them only on macOS build steps.

### Downloading artifacts

Artifacts are produced on every build (tagged or manual). To download:

1. Go to repo → **Actions** tab
2. Click the workflow run
3. Scroll to bottom → **Artifacts** section
4. Download `app-macOS-ARM`, `app-macOS-Intel`, `app-Linux`, or `app-Windows`
5. Artifacts expire after 90 days

### Creating a release

```bash
git tag v0.2.0
git push origin v0.2.0
```

This triggers the same builds, then creates a **draft GitHub Release** with all installers attached. Go to repo → **Releases** → edit the draft → click **Publish**.

### What gets built

| Platform | Artifacts |
|---|---|
| macOS ARM (Apple Silicon) | `.app`, `.dmg` (signed + notarized) |
| macOS Intel | `.app` (signed + notarized) |
| Linux | `.deb`, `.AppImage` |
| Windows | `.msi`, `.exe` (NSIS installer) |

## Auto-Updates

The app checks for updates on launch, notifies the user, and lets them download + restart when ready. No auto-download — user stays in control.

### How it works (user experience)

1. App launches → silent check (if auto-check enabled in Settings > Updates)
2. Update found → toast: "Shoulders v1.2.0 available" with **Download** button
3. User clicks Download → progress visible in Settings > Updates
4. Download done → toast: "Update ready. Restart to apply." with **Restart** button
5. User can also manage everything from Settings > Updates (its own tab in the sidebar)

### Architecture

- **Plugin**: `tauri-plugin-updater` (Tauri v2 official) + `tauri-plugin-process` (for relaunch)
- **Signing**: Every update artifact (`.app.tar.gz`, NSIS installer, AppImage) is signed with a Tauri-specific keypair (separate from Apple code signing). The app verifies signatures before installing.
- **Endpoint**: The app calls `shoulde.rs/api/v1/updates/latest.json`, which proxies `latest.json` from the GitHub Release (10-min cache). The app never contacts GitHub directly.
- **Why the proxy?** If the GitHub repo is ever renamed, just update the `GITHUB_REPO` env var on the server. No client-side change needed, no app update required.

### Key files

| File | Role |
|---|---|
| `src/services/appUpdater.js` | Frontend: `checkForUpdate()`, `downloadUpdate()`, `installAndRestart()`, auto-check pref |
| `src/App.vue` | Silent check on launch, toast-driven download + restart flow |
| `src/components/settings/SettingsUpdates.vue` | Settings > Updates tab: toggle, manual check, progress bar, version, restart |
| `src/stores/toast.js` | Extended with `action: { label, onClick }` and `duration: 0` for persistent toasts |
| `src/components/layout/ToastContainer.vue` | Renders action buttons on toasts |
| `src-tauri/src/lib.rs` | Plugin registration (updater in `.setup()`, process as plugin) |
| `src-tauri/tauri.conf.json` | `createUpdaterArtifacts: true` + `plugins.updater` config (pubkey + endpoint) |
| `src-tauri/capabilities/default.json` | `updater:default` + `process:allow-restart` permissions |
| `web/server/api/v1/updates/latest.json.get.js` | Server proxy endpoint |
| `.github/workflows/build.yml` | `TAURI_SIGNING_*` env vars + `includeUpdaterJson: true` |

### First-time setup (do this once, before first release)

This is the manual work. Everything after this is automated by CI.

#### Step 1: Generate the updater signing keypair

```bash
npx tauri signer generate -w ~/.tauri/shoulders.key
```

It will ask for a password. Choose one and save it somewhere safe (you'll need it for GitHub secrets).

The command prints two things:
- **Private key**: saved to `~/.tauri/shoulders.key`
- **Public key**: printed to stdout (a long base64 string starting with `dW50cnVz...`)

**Copy the public key** — you need it in step 2.

#### Step 2: Paste the public key into tauri.conf.json

Open `src-tauri/tauri.conf.json` and replace `PASTE_PUBLIC_KEY_HERE`:

```json
"updater": {
  "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWdu...",
  "endpoints": [
    "https://shoulde.rs/api/v1/updates/latest.json"
  ]
}
```

This is the only place the public key lives. It's committed to the repo — that's fine, it's public.

#### Step 3: Add 2 secrets to GitHub

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.

| Secret name | Value |
|---|---|
| `TAURI_SIGNING_PRIVATE_KEY` | The full content of `~/.tauri/shoulders.key` (run `cat ~/.tauri/shoulders.key` and copy) |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | The password you chose in step 1 |

The CI workflow (`.github/workflows/build.yml`) already references these — they're passed as env vars to both the CI build and the release build steps.

#### Step 4: Deploy the server endpoint

The file `web/server/api/v1/updates/latest.json.get.js` is already written. It will be live after the next server deploy. Make sure the `GITHUB_REPO` env var on the server is set to your repo (e.g. `shoulders-ai/shoulders`). This is the same env var already used by `releases.get.js`.

#### Step 5: Back up the private key

**This is critical.** If you lose `~/.tauri/shoulders.key`, every existing install is permanently stuck — they can't verify updates signed with a different key. The only recovery is users manually downloading and reinstalling.

Back it up somewhere safe (password manager, encrypted drive, etc.).

#### Verify everything works

After steps 1-4 are done, the next tagged release will automatically:
1. Build all platforms with `TAURI_SIGNING_*` env vars present
2. Produce `latest.json` + `.sig` files (because `includeUpdaterJson: true`)
3. Attach them to the draft GitHub Release
4. The server endpoint proxies `latest.json` to the app

### Testing updates locally (end-to-end)

The updater doesn't work in `npx tauri dev` — it needs a production build. Here's how to test the full check → download → install flow on your Mac:

#### 1. Temporarily point the endpoint to localhost

Edit `src-tauri/tauri.conf.json`:
```json
"updater": {
  "pubkey": "dW50cnVz...",
  "endpoints": [
    "http://localhost:9999/latest.json"
  ]
}
```

#### 2. Build the "old" app (v0.1.0)

```bash
source .env && npx tauri build --bundles app --target aarch64-apple-darwin
```

Copy it somewhere safe — this is the app you'll run to test the update:
```bash
cp -r src-tauri/target/aarch64-apple-darwin/release/bundle/macos/Shoulders.app /tmp/Shoulders-v0.1.0.app
```

#### 3. Bump version to v0.2.0

Change all three files:
- `src-tauri/tauri.conf.json` → `"version": "0.2.0"`
- `src-tauri/Cargo.toml` → `version = "0.2.0"`
- `package.json` → `"version": "0.2.0"`

#### 4. Build the "new" app (v0.2.0)

```bash
source .env && npx tauri build --bundles app --target aarch64-apple-darwin
```

This produces the update artifacts:
```
src-tauri/target/aarch64-apple-darwin/release/bundle/macos/
├── Shoulders.app
├── Shoulders.app.tar.gz       ← the update payload
└── Shoulders.app.tar.gz.sig   ← the signature
```

#### 5. Create latest.json

Read the signature file and create the JSON that the updater expects:
```bash
cd src-tauri/target/aarch64-apple-darwin/release/bundle/macos

# Read the signature
SIG=$(cat Shoulders.app.tar.gz.sig)

# Create latest.json
cat > latest.json << EOF
{
  "version": "0.2.0",
  "notes": "Test update",
  "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": {
    "darwin-aarch64": {
      "signature": "$SIG",
      "url": "http://localhost:9999/Shoulders.app.tar.gz"
    }
  }
}
EOF
```

#### 6. Start a local file server

From the same directory (where `latest.json` + `Shoulders.app.tar.gz` are):
```bash
python3 -m http.server 9999
```

#### 7. Run the old app and trigger the update

```bash
open /tmp/Shoulders-v0.1.0.app
```

Then go to **Settings > Updates > Check for updates**. You should see "v0.2.0 available" with a Download button. Click it, watch the progress bar, then click Restart.

#### 8. Clean up

After testing, restore `tauri.conf.json`:
- Version back to `0.1.0` (or whatever it should be)
- Endpoint back to `https://shoulde.rs/api/v1/updates/latest.json`
- Revert `Cargo.toml` and `package.json` versions too

### Testing via CI (the real release flow)

If you want to test the full production pipeline without affecting real users:

1. Bump version to `0.2.0-alpha.1` in all 3 files
2. Tag and push: `git tag v0.2.0-alpha.1 && git push origin main v0.2.0-alpha.1`
3. CI builds all platforms → creates draft release with `latest.json`
4. **Don't publish the release** — inspect the artifacts in the draft to verify `.app.tar.gz`, `.sig`, and `latest.json` are all present
5. If you want to test the full flow: publish the release, then run an older build and check for updates
6. Delete the release + tag when done: `git push --delete origin v0.2.0-alpha.1 && git tag -d v0.2.0-alpha.1`

### Releasing a new version (ongoing, after first-time setup)

Every release follows the same 3 steps:

#### 1. Bump the version in 3 files

These must match:

| File | Field |
|---|---|
| `src-tauri/tauri.conf.json` | `"version": "0.2.0"` |
| `src-tauri/Cargo.toml` | `version = "0.2.0"` |
| `package.json` | `"version": "0.2.0"` |

#### 2. Tag and push

```bash
git add -A && git commit -m "Bump version to 0.2.0"
git tag v0.2.0
git push origin main v0.2.0
```

#### 3. Publish the release

1. CI builds all platforms → creates a **draft** GitHub Release with all artifacts + `latest.json`
2. Go to repo → **Releases** → edit the draft → write release notes → click **Publish**
3. Within 10 minutes, all existing installs will see the update toast

### Platform-specific update behavior

| Platform | Update artifact | Notes |
|---|---|---|
| macOS | `.app.tar.gz` + `.app.tar.gz.sig` | Must be signed + notarized. `createUpdaterArtifacts: true` produces these alongside the `.app` |
| Windows | NSIS installer `.exe` + `.nsis.zip.sig` | Standard NSIS update — closes app, installs, relaunches |
| Linux | `.AppImage` + `.AppImage.sig` | AppImage is the only Linux format that supports auto-update |

### Troubleshooting

**"Check for updates" always says "up to date":**
- Is the GitHub Release published (not draft)?
- Does `shoulde.rs/api/v1/updates/latest.json` return valid JSON? (Try in browser)
- Is the `GITHUB_REPO` env var correct on the server?
- Is the version in `tauri.conf.json` lower than the release tag?

**Download fails:**
- Check internet connectivity
- Check the release has the correct platform artifacts (`.app.tar.gz`, not just `.app`)
- Check the `.sig` files exist alongside each artifact

**"Signature verification failed":**
- The public key in `tauri.conf.json` doesn't match the private key used to sign the release
- This happens if someone regenerated the keypair without updating `tauri.conf.json`
- Fix: update the pubkey in `tauri.conf.json` and release a new version (users on the broken version must manually reinstall)

## Changing the Icon

1. Save your new image (square, 1024px+)
2. Convert to RGBA PNG:
   ```bash
   python3 -c "from PIL import Image; Image.open('new-icon.png').convert('RGBA').save('src-tauri/icons/icon.png')"
   ```
   JPEG has no alpha channel — Tauri requires RGBA or the build panics.
3. Regenerate `.icns` for macOS:
   ```bash
   cd src-tauri/icons && mkdir icon.iconset
   for s in 16 32 64 128 256 512 1024; do sips -z $s $s icon.png --out icon.iconset/icon_${s}x${s}.png; done
   cp icon.iconset/icon_{32x32,16x16@2x}.png
   cp icon.iconset/icon_{64x64,32x32@2x}.png
   cp icon.iconset/icon_{256x256,128x128@2x}.png
   cp icon.iconset/icon_{512x512,256x256@2x}.png
   cp icon.iconset/icon_{1024x1024,512x512@2x}.png
   rm icon.iconset/icon_{64x64,1024x1024}.png
   iconutil -c icns icon.iconset -o icon.icns && rm -rf icon.iconset
   ```
4. Regenerate `.ico` for Windows:
   ```bash
   python3 -c "
   from PIL import Image
   import struct, io
   src = Image.open('src-tauri/icons/icon.png').convert('RGBA')
   sizes, num = [16,32,48,64,128,256], 6
   imgs = [src.resize((s,s), Image.LANCZOS) for s in sizes]
   hdr = struct.pack('<HHH', 0, 1, num)
   entries, blocks, off = b'', [], 6 + 16*num
   for img in imgs:
       buf = io.BytesIO(); img.save(buf, format='PNG'); d = buf.getvalue()
       w = img.width if img.width < 256 else 0
       h = img.height if img.height < 256 else 0
       entries += struct.pack('<BBBBHHII', w, h, 0, 0, 1, 32, len(d), off)
       blocks.append(d); off += len(d)
   open('src-tauri/icons/icon.ico','wb').write(hdr + entries + b''.join(blocks))
   "
   ```
5. Regenerate sized PNGs for Linux:
   ```bash
   python3 -c "
   from PIL import Image
   src = Image.open('src-tauri/icons/icon.png')
   src.resize((32,32), Image.LANCZOS).save('src-tauri/icons/32x32.png')
   src.resize((128,128), Image.LANCZOS).save('src-tauri/icons/128x128.png')
   src.resize((256,256), Image.LANCZOS).save('src-tauri/icons/128x128@2x.png')
   "
   ```
6. Rebuild. `tauri.conf.json` already points to all icon files.
