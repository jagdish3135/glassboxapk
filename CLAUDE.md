# GlassBoxAPK

The full workflow for analysing an APK lives in AGENTS.md (shared with Codex, Cursor and other agents) and is imported here:

@AGENTS.md

## Claude Code notes

- When the user says "Analyze apks/<file>.apk", run the whole workflow above: decompile, scan, trace, validate, view.
- Start `npm run view <name>` with `run_in_background`, then read its output for the URL. If you have a browser tool, you can open the URL there too.
- Use Grep and Glob on `work/<name>/sources` to find code; read only the files a flow passes through.
- Write the report with the Write or Edit tool, then run `npm run validate-report reports/<name>.json` until it passes.
