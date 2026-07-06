# Installing example skills

JARVIS loads skills from `app_data/skills/` (global) and `app_data/skills/{profileId}/` (profile overrides).

## Fixture skills (development)

Bundled fixtures live under [`apps/desktop/tests/fixtures/skills/`](../apps/desktop/tests/fixtures/skills/).

### Hello skill

1. Copy the folder to your app data skills directory:

```powershell
$skills = "$env:APPDATA\com.jarvis.desktop\skills"
New-Item -ItemType Directory -Force -Path $skills | Out-Null
Copy-Item -Recurse apps/desktop/tests/fixtures/skills/hello $skills\hello
```

2. Validate the manifest:

```powershell
npm --workspace @jarvis/skill-sdk run validate -- apps/desktop/tests/fixtures/skills/hello/skill.json
```

3. In the desktop app, open **Installed skills** and confirm `Hello skill` appears. Route phrases include `hello skill` and `wave16 hello`.

## Marketplace install (T17-F)

The desktop **Installed skills** panel lists catalog entries from `apps/desktop/src-tauri/marketplace/catalog.json`. Click **Install** to copy a validated skill into `app_data/skills/`.

## Authoring a new skill

1. Create `app_data/skills/<id>/skill.json` using the Skill SDK schema.
2. Run `npm --workspace @jarvis/skill-sdk run validate -- <path>/skill.json`.
3. Enable the skill in gateway settings if needed; keywords merge at route time via `match_dynamic_skill`.

Handlers: `route`, `http`, `script`, and bounded `wasm` (see Wave 17 T17-B).
