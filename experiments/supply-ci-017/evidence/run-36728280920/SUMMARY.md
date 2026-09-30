# SUPPLY-CI-017

GitHub runner only, NOT Render. Fixed 0.5 CPU/512 MiB; no swap headroom; unchanged 3s budget.

```json
{
  "source_sha": "813b4072568352e95d0726fe5fe04060c889c554",
  "workflow_sha": "d27dd0a65b3bc8ab28a492e21c425bbdaad84a3b",
  "environment": "GitHub ubuntu-24.04; NOT Render",
  "budget_seconds": 3,
  "limits": {
    "cpus": 0.5,
    "memory_bytes": 536870912,
    "memory_swap_bytes": 536870912,
    "pids": 128
  },
  "passed": false,
  "dockerfile_sha256": "f3dfd04c5a687e17849e375de672874712df087cecb50b9a9e557f9656f4b0b1",
  "build_context": "repository root",
  "build_seconds": 27.248281843,
  "image_id": "sha256:6bff093f70bf9c838c6555bf65b92807d1249be7b5aff930b77e61ad44e95c0d",
  "startup_seconds": 3.3864623040000055,
  "health": {
    "ready": true,
    "version": "SUPPLY-INTEGRATE-015-v1",
    "source": "aca1f4b9801ab7b7c7073ac7973bb028cd6df435"
  },
  "assets": [
    {
      "path": "/?supply=experiment",
      "bytes": 1540,
      "http_seconds": 0.0014110949999945888,
      "sha256": "f7e7abfe63248d2afbd639a1f83233ec1d3c3afbbc7b6979f41d6363eccc4b6b"
    },
    {
      "path": "./app/web/startupShell.js",
      "bytes": 768
    },
    {
      "path": "./app/main.js",
      "bytes": 77051
    },
    {
      "path": "/styles.css",
      "bytes": 57893,
      "http_seconds": 0.0010430940000105693,
      "sha256": "14cf1f48999b164e5a4e8c283e7738fe0e1cdceec58107601b0fe04c67453cbe"
    }
  ],
  "failure": "<HTTPError 404: 'Not Found'>",
  "final_inspect": {
    "state": {
      "Status": "running",
      "Running": true,
      "Paused": false,
      "Restarting": false,
      "OOMKilled": false,
      "Dead": false,
      "Pid": 3087,
      "ExitCode": 0,
      "Error": "",
      "StartedAt": "2026-09-30T14:20:31.226983407Z",
      "FinishedAt": "0001-01-01T00:00:00Z"
    },
    "limits": {
      "NanoCpus": 500000000,
      "Memory": 536870912,
      "MemorySwap": 536870912,
      "PidsLimit": 128
    }
  }
}
```
