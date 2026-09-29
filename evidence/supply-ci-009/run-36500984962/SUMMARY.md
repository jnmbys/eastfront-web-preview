# SUPPLY-CI-009
Runtime SHA: 9cf0e5fb7fac27e16b2700559716b590e81957b7
GitHub runner limits only; not Render performance.

| Profile | Passed | Cold starts (s) | Served workload peak MiB | Contracts |
|---|---|---|---|---|
| 512m-halfcpu | False | 2.63, 2.527, 2.526 | 199.24 | 1 |
| 2g-onecpu | False | 1.467, 1.473, 1.459 | 202.87 | 1 |
| 512m-tenthcpu | False | 13.259, 12.196, 12.147 | 177.34 | 1 |

memory.peak includes all processes in the container cgroup, including small measurement commands. Separate peak including contract test process is retained in report.json. Three cold starts/profile; nine clip sequences and four live sessions on first cold start. Failures/timeouts retained.
No published image, service or cloud resource. Artifacts expire after 7 days.
