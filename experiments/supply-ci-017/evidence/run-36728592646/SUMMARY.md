# SUPPLY-CI-017

GitHub runner only, NOT Render. Fixed 0.5 CPU/512 MiB; no swap headroom; unchanged 3s budget.

```json
{
  "source_sha": "813b4072568352e95d0726fe5fe04060c889c554",
  "workflow_sha": "9034ac2617520a9c749cf0330f64b0395c29e0bf",
  "environment": "GitHub ubuntu-24.04; NOT Render",
  "budget_seconds": 3,
  "limits": {
    "cpus": 0.5,
    "memory_bytes": 536870912,
    "memory_swap_bytes": 536870912,
    "pids": 128
  },
  "passed": true,
  "dockerfile_sha256": "f3dfd04c5a687e17849e375de672874712df087cecb50b9a9e557f9656f4b0b1",
  "build_context": "repository root",
  "build_seconds": 26.44456140599999,
  "image_id": "sha256:cc5675d240625a956db4c02fab219c57c0e85bd368004fe4db67f81e421d53e3",
  "startup_seconds": 2.828766946999991,
  "health": {
    "ready": true,
    "version": "SUPPLY-INTEGRATE-015-v1",
    "source": "aca1f4b9801ab7b7c7073ac7973bb028cd6df435"
  },
  "assets": [
    {
      "path": "/?supply=experiment",
      "bytes": 1540,
      "http_seconds": 0.001460101000020586,
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
      "http_seconds": 0.0010029510000038044,
      "sha256": "14cf1f48999b164e5a4e8c283e7738fe0e1cdceec58107601b0fe04c67453cbe"
    },
    {
      "path": "/app/experimental/supplyClient.js",
      "bytes": 8053,
      "http_seconds": 0.0009967789999905108,
      "sha256": "6be1a0dfb4e6b9a34995b8e1a77cd680769043e98c5e4be25e9dcf333a976fbc"
    }
  ],
  "service_only_peak_bytes": 124129280,
  "service_cgroup": {
    "memory.events": "low 0\nhigh 0\nmax 0\noom 0\noom_kill 0\noom_group_kill 0",
    "cpu.stat": "usage_usec 1275253\nuser_usec 1014675\nsystem_usec 260578\nnice_usec 0\ncore_sched.force_idle_usec 0\nnr_periods 29\nnr_throttled 24\nthrottled_usec 1340108\nnr_bursts 0\nburst_usec 0",
    "cpu.max": "50000 100000",
    "memory.max": "536870912",
    "memory.swap.max": "0"
  },
  "service_memory_scope": "default service.py + warm solver + descendants; HTTP acceptance client runs on host outside cgroup; includes transient docker exec reader",
  "startup_inspect": {
    "state": {
      "Status": "running",
      "Running": true,
      "Paused": false,
      "Restarting": false,
      "OOMKilled": false,
      "Dead": false,
      "Pid": 2993,
      "ExitCode": 0,
      "Error": "",
      "StartedAt": "2026-09-30T14:22:54.755803625Z",
      "FinishedAt": "0001-01-01T00:00:00Z"
    },
    "limits": {
      "NanoCpus": 500000000,
      "Memory": 536870912,
      "MemorySwap": 536870912,
      "PidsLimit": 128
    }
  },
  "startup_stopped_inspect": {
    "state": {
      "Status": "exited",
      "Running": false,
      "Paused": false,
      "Restarting": false,
      "OOMKilled": false,
      "Dead": false,
      "Pid": 0,
      "ExitCode": 137,
      "Error": "",
      "StartedAt": "2026-09-30T14:22:54.755803625Z",
      "FinishedAt": "2026-09-30T14:23:07.921191726Z"
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
      "StartedAt": "2026-09-30T14:23:08.0893498Z",
      "FinishedAt": "2026-09-30T14:23:34.086320213Z"
    },
    "limits": {
      "NanoCpus": 500000000,
      "Memory": 536870912,
      "MemorySwap": 536870912,
      "PidsLimit": 128
    }
  },
  "final_inspect": {
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
      "StartedAt": "2026-09-30T14:23:08.0893498Z",
      "FinishedAt": "2026-09-30T14:23:34.086320213Z"
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
