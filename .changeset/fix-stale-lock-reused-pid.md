---
"@aliou/sesame": patch
"@aliou/sesame-cli": patch
---

Fix stale index lock when the recorded watch pid was reused by an unrelated
process. `isProcessAlive` treated `EPERM` from `process.kill(pid, 0)` as
"alive", so a dead watch whose pid got recycled by a system process (e.g.
`mediaremoteagent`) left the lock permanently un-clearable and the launchd
agent crash-looping with "Index already running". EPERM now means the pid
is not ours and the stale lock is removed.
