# SUPPLY-CAMPAIGN-012

GitHub runner only, NOT Render. One cold start; fixed 0.5 CPU/512 MiB, no swap headroom, 3s transactions.

```json
{
  "source_sha": "aca1f4b9801ab7b7c7073ac7973bb028cd6df435",
  "workflow_sha": "e71b9f66e5fa5cc494c2bd7bbaca277b8b4aa82a",
  "environment": "GitHub ubuntu-24.04; NOT Render",
  "limits": {
    "cpus": 0.5,
    "memory_bytes": 536870912,
    "memory_swap_bytes": 536870912,
    "pids": 128
  },
  "budget_seconds": 3,
  "passed": true,
  "dockerfile_sha256": "729cf4920229583adac7d212451295489878b709ca3a57c930270b67aa63e7a1",
  "dockerfile_blob": "d6b31d347762298e11472023a1e622ac8aac149b",
  "build_seconds": 23.874579949000008,
  "image_id": "sha256:20a98412cf7444c212b285009d5d593564c3577ba58c197ecef4819432235ec7",
  "startup_seconds": 2.2224456210000056,
  "startup_peak_bytes": 118063104,
  "four_empty_campaign_sessions_peak_bytes": 150536192,
  "startup_inspect": {
    "state": {
      "Status": "running",
      "Running": true,
      "Paused": false,
      "Restarting": false,
      "OOMKilled": false,
      "Dead": false,
      "Pid": 2712,
      "ExitCode": 0,
      "Error": "",
      "StartedAt": "2026-09-30T06:02:51.121395023Z",
      "FinishedAt": "0001-01-01T00:00:00Z"
    },
    "limits": {
      "NanoCpus": 500000000,
      "Memory": 536870912,
      "MemorySwap": 536870912,
      "PidsLimit": 128
    }
  },
  "targeted_exit": 0,
  "targeted_inspect": {
    "state": {
      "Status": "exited",
      "Running": false,
      "Paused": false,
      "Restarting": false,
      "OOMKilled": false,
      "Dead": false,
      "Pid": 0,
      "ExitCode": 0,
      "Error": "",
      "StartedAt": "2026-09-30T06:02:56.662744388Z",
      "FinishedAt": "2026-09-30T06:03:33.369358289Z"
    },
    "limits": {
      "NanoCpus": 500000000,
      "Memory": 536870912,
      "MemorySwap": 536870912,
      "PidsLimit": 128
    }
  },
  "targeted_summary": {
    "budget_seconds": 3,
    "scope": "targeted 117->128, four sessions; not full campaign or Render validation",
    "passed": true,
    "harness_startup_seconds": 1.3140498150000042,
    "four_campaign_sessions": true,
    "short_clip_reset_compatibility": true,
    "old_campaign_reset": true,
    "checkpoint": {
      "revision": 117,
      "hash": "93285766e651fef9823626c4eda7f12d11d1972ad5e80bfb34991e8f1c90c78b",
      "source": "evidence/campaign011-close/checkpoint-117.json.gz",
      "test_only_injection": true
    },
    "four_populated_sessions_peak_bytes": 178728960,
    "representative_delivery": true,
    "session_isolation": true,
    "timeout_rollback": {
      "passed": true,
      "budget_seconds": 3,
      "fault": "late frame latency after accepted Core Action",
      "http_seconds": 3.6314874469999836,
      "error": "未提交：行动不合法、版本过期或整次事务未解；原状态与资源保留。",
      "full_state_rng_journal_seen_unchanged": true
    },
    "busy_rejected_without_commit": true,
    "information_filtering": true,
    "reset_isolation": true,
    "final_peak_bytes": 254205952
  },
  "actions": [
    {
      "revision": 118,
      "action": "RAIL_REPAIR",
      "status": 200,
      "accepted": true,
      "http_seconds": 1.612822470999987,
      "transaction": {
        "ok": true,
        "seconds": 0.8085857389999944
      },
      "error": null,
      "hash_equal": true,
      "settled": false
    },
    {
      "revision": 119,
      "action": "END_PHASE",
      "status": 200,
      "accepted": true,
      "http_seconds": 1.5592683280000017,
      "transaction": {
        "ok": true,
        "seconds": 0.7408081460000062
      },
      "error": null,
      "hash_equal": true,
      "settled": false
    },
    {
      "revision": 120,
      "action": "END_PHASE",
      "status": 200,
      "accepted": true,
      "http_seconds": 1.5459493779999889,
      "transaction": {
        "ok": true,
        "seconds": 0.8007127409999839
      },
      "error": null,
      "hash_equal": true,
      "settled": false
    },
    {
      "revision": 121,
      "action": "END_PHASE",
      "status": 200,
      "accepted": true,
      "http_seconds": 1.6269064180000044,
      "transaction": {
        "ok": true,
        "seconds": 0.8087153760000092
      },
      "error": null,
      "hash_equal": true,
      "settled": false
    },
    {
      "revision": 122,
      "action": "END_PHASE",
      "status": 200,
      "accepted": true,
      "http_seconds": 1.6253761210000164,
      "transaction": {
        "ok": true,
        "seconds": 0.8129214049999973
      },
      "error": null,
      "hash_equal": true,
      "settled": false
    },
    {
      "revision": 123,
      "action": "END_PHASE",
      "status": 200,
      "accepted": true,
      "http_seconds": 1.642625116000005,
      "transaction": {
        "ok": true,
        "seconds": 0.8141668980000247
      },
      "error": null,
      "hash_equal": true,
      "settled": false
    },
    {
      "revision": 124,
      "action": "END_PHASE",
      "status": 200,
      "accepted": true,
      "http_seconds": 1.6505566390000013,
      "transaction": {
        "ok": true,
        "seconds": 0.8828261440000063
      },
      "error": null,
      "hash_equal": true,
      "settled": false
    },
    {
      "revision": 125,
      "action": "END_PHASE",
      "status": 200,
      "accepted": true,
      "http_seconds": 1.6474197670000024,
      "transaction": {
        "ok": true,
        "seconds": 0.8702843469999948
      },
      "error": null,
      "hash_equal": true,
      "settled": false
    },
    {
      "revision": 126,
      "action": "END_PHASE",
      "status": 200,
      "accepted": true,
      "http_seconds": 1.6213401939999983,
      "transaction": {
        "ok": true,
        "seconds": 0.8296658990000196
      },
      "error": null,
      "hash_equal": true,
      "settled": false
    },
    {
      "revision": 127,
      "action": "END_PHASE",
      "status": 200,
      "accepted": true,
      "http_seconds": 1.644989645999999,
      "transaction": {
        "ok": true,
        "seconds": 0.8316508880000129
      },
      "error": null,
      "hash_equal": true,
      "settled": false
    },
    {
      "revision": 128,
      "action": "END_PHASE",
      "status": 200,
      "accepted": true,
      "http_seconds": 2.4201716110000007,
      "transaction": {
        "ok": true,
        "seconds": 1.6020999940000138
      },
      "error": null,
      "hash_equal": true,
      "settled": true
    }
  ]
}
```

Populated-session peak includes in-container test driver and checkpoint copies. No full-game replay.
