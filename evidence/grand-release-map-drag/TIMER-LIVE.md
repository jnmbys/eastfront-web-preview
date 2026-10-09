# Timer binding live verification

Runtime source: 3e34733b2361597a3efcb225661dd115a02db9e5.
Render deploy dep-db47kktg1s2s738hhg60 is live. Same service, instance type, persistent disk, authentication and save format. No user saves reset.

Local tested commit fea3d8a05db36bb3837095277fb2991f3f758a7c and remote source have the exact same Git tree 18093139c855a9309de822169a0b4a267f29b454. Ordinary Git push hung and was stopped only for its identified process tree. One bounded HTTP/1.1 attempt failed with:

```
fatal: unable to access 'https://github.com/jnmbys/eastfront-web-preview.git/': Recv failure: Connection was reset
```

Local complete-history recovery bundle verified at .release-artifact/timer-binding-fix.bundle. Used already authorized GitHub connector to create identical tree and commit, then fast-forwarded preview branch with expected-head protection (no force). Commit metadata differs, hence different commit SHA. Runtime and fix branch heads independently read through GitHub API. Main/source-main unchanged. Local branch retains tested fea3d8a; future work must fetch/resolve published 3e34733 before advancing the release branch.

Receiver-validating host timer regression reproduces old Illegal invocation in BOTH setTimeout and clearTimeout paths. Candidate passes. Drag scheduling and 7 camera interaction tests pass; clean release build passes. Browser-control getTab timed out in 40 seconds, so graphical startup and physical tablet smoothness are not claimed.

Public HTTPS/WSS smoke confirms exact runtime version, served main/scheduler/city modules byte-equal to locally built files, and cache revalidation. Isolated test visitor only: authorized preview, accepted DIRECT intent, acknowledged SAVE, paused reconnect with intent retained. This is not a GUI launch or completed march.

Refresh the existing URL and continue; retain visitor cookie. No new game or clearing storage required.

```json
{
  "at": "2026-10-09T05:25:37.350Z",
  "scope": "Public HTTPS/WSS, actual transport Client with Node network adapters; existing isolated test visitor, not UI/tablet acceptance",
  "checks": [
    "Actual authorized route preview, explicit accepted DIRECT move intent",
    "Durable SAVE acknowledged",
    "Paused reconnect preserves intent, no new duplicate command"
  ],
  "build": {
    "release": "GRAND-RELEASE-001",
    "source": "3e34733b2361597a3efcb225661dd115a02db9e5",
    "dirty": false,
    "rules": "GRAND-TERRITORY-1",
    "save": "GRAND-RELEASE-TERRITORY-1",
    "assetsSHA256": "28ef07920eb2fd9168789bbd334145b7266cf2bef58551fcc32b243b9d08f8f6",
    "fileCount": 556,
    "totalBytes": 17972412
  },
  "assets": [
    {
      "file": "src/main.js",
      "status": 200,
      "cache": "private, max-age=0, must-revalidate",
      "bytes": 118455
    },
    {
      "file": "src/interaction/viewportWork.js",
      "status": 200,
      "cache": "private, max-age=0, must-revalidate",
      "bytes": 1591
    },
    {
      "file": "src/render/cityArtRuntime.js",
      "status": 200,
      "cache": "private, max-age=0, must-revalidate",
      "bytes": 14367
    }
  ],
  "status": "PASS",
  "series": [
    {
      "type": "direct-move",
      "receiptMs": 896,
      "result": "APPLIED"
    }
  ]
}
```
