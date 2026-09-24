# Troubleshooting

| Symptom | Next step for your agent |
| --- | --- |
| Missing skills | Verify installed/enabled state, then start a fresh Codex session. |
| Skills work but tools fail | Check actual installed MCP startup; registration alone is insufficient. |
| Schema conflict | Compare customized files with the bundle and propose a scoped resolution. |
| Store pointer found | Select the owning local Git repository or retain the existing store workflow. |
| Several active changes | Select the intended change. |
| Stale evidence | Rerun relevant checks and refresh independent review. |
| Incorrect task status | Use `$projector:reconcile`. |
| Working branch unchanged | Review and integrate the isolated candidate. |
| Old owner rejects new version | Settle active operations and restart the authenticated owner. |

The agent should explain the concrete problem and next step. Internal commands belong in the [runtime reference](reference/runtime.md) and [development guide](development.md).
