# BGG public-data integration

The account dialog supports registering a BGG username, importing owned board games, and saving public plays separately from Score Counter score records. This is not BGG account authentication. No BGG password is collected and the app does not write records to BGG.

BGG approval, an API token, Firebase deployment access, and a project with Functions billing enabled are required for live imports. The frontend must not contain the API token.

From the repository root:

```bash
npx firebase-tools login
npx firebase-tools functions:secrets:set BGG_API_TOKEN --project score-1948e
npm --prefix functions install
npx firebase-tools deploy --only functions:bggSearch,firestore:rules --project score-1948e
```

Set `bggSearchUrl` in `firebase-config.js` to the function URL returned by deployment. The same endpoint supports search and authenticated `action=collection` / `action=plays` requests. Publish the updated configuration to GitHub Pages.

Firestore stores the username at `users/{uid}/settings/bgg`, owned games under `bggCollection`, and public plays under `bggPlays`. Rules restrict these to the signed-in Google account. Registering before deploying the new rules stores the username locally and reports that cloud saving failed.

Imports are on demand, retain BGG record IDs, replace the current imported snapshot for the registered username, and import at most 10 pages / 1,000 play records per request sequence. BGG quantity and unknown scores are preserved. They do not contribute to existing score statistics because BGG records do not reliably specify the app's scoring rule. BGG queued responses (202) and throttling (429) ask the user to retry later; they do not erase previously imported information.
