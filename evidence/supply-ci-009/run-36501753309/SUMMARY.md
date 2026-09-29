# SUPPLY-CI-009
Runtime SHA: 9cf0e5fb7fac27e16b2700559716b590e81957b7
GitHub runner limits only; not Render performance.

| Profile | Passed | Cold starts (s) | Served workload peak MiB | Contracts |
|---|---|---|---|---|
| 512m-halfcpu | True | 2.622, 2.538, 2.532 | 199.67 | 0 |
| 2g-onecpu | True | 1.48, 1.487, 1.474 | 203.15 | 0 |
| 512m-tenthcpu | False | 12.923, 12.762, 12.692 | 175.76 | 1 |

memory.peak includes all processes in the container cgroup, including small measurement commands. Separate peak including contract test process is retained in report.json. Three cold starts/profile; nine clip sequences and four live sessions on first cold start. Failures/timeouts retained.
No published image, service or cloud resource. Artifacts expire after 7 days.
