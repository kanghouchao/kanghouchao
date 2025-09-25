# WakaTime Action README

This folder contains a script to update the repository README with WakaTime stats.

Secrets
- Add `WAKATIME_API_KEY` to repository secrets (your WakaTime api key).

Local test
1. Install Node.js (>=16) and run:

```bash
WAKATIME_API_KEY=your_api_key node .github/scripts/update-waka.js
```

This updates `README.md` in-place. Commit and review changes before pushing.
