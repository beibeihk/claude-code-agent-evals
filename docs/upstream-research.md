# Claude Code Action upstream audit — 2026-10-03

**Outcome: no upstream PR submitted.** Three current-main failures were reproduced,
but each already has open repair PRs. The user's explicit non-duplicate quality
gate takes precedence over producing a PR count. No upstream code was modified,
fork created, reviewer requested, or external comment posted. This is research
evidence, not an accepted Anthropic contribution.

## Baseline and reading record

Repository: [anthropics/claude-code-action](https://github.com/anthropics/claude-code-action).
Main was independently rechecked as
[`ed670b4cf9de2a5a570d130d2f6197b9e543cd64`](https://github.com/anthropics/claude-code-action/tree/ed670b4cf9de2a5a570d130d2f6197b9e543cd64).
Runtime: Bun 1.3.13, Windows 11 x64. SDK dependency: 0.3.288.

Read CONTRIBUTING, README, package manifests, action metadata, source/test modules,
configuration/provider/setup docs, workflow examples, issue template, the latest
100 commits and latest 20 merged PRs. No PR template was found in the current
checkout. An all-pages issue-title index contains 471 open issues; this is an
inventory, not a claim to have read all 471 bodies. The detailed candidate review
below exceeds 15 issues. Open PRs were paginated, supplemented by targeted searches
and direct PR state checks before deciding against a duplicate submission.

The 20-PR reading record includes workflow hardening/model pinning, bounded CI log
fetching, branch URL/name handling, line endings, prompt-tool schema corrections,
redaction, subprocess environment reduction, restored-config staging, aggregate
MCP selectors, fork CI gates, shallow history, executable PATH, repository path
validation, binary-file encoding, CI pagination, image timeouts and multi-block
tool-summary rendering. Raw research responses remain outside this release.

## Architecture and permission boundaries

`src/github/context.ts` converts the webhook/environment into entity or automation
context and inputs. `src/modes/detector.ts` selects tag versus agent mode from
trigger evidence, explicit prompts and progress configuration. A dispatch event
does not have the same entity/comment fields as a PR event; tests must model the
actual payload type. `pull_request_target` is normalized for downstream handling.

`src/entrypoints/run.ts` coordinates GitHub authentication, actor/write checks,
mode preparation, CLI installation, WIF setup, trusted-base configuration restore,
settings/plugins, prompt construction and the SDK invocation. Tag mode creates
tracking comments and repository context; agent mode uses the authored prompt.
GitHub MCP servers expose comment, inline review, CI and signed file operations.
The SDK result drives execution/session/structured outputs. Finally blocks stop
identity refresh, update comments, write summaries and expose branch/token outputs;
composite post steps deliver buffered comments, remove SSH keys and revoke App tokens.

GitHub authentication and model authentication are separate. A supplied GitHub
token or OIDC/App exchange supports repository operations. Actor checks constrain
bot loops and write-access exceptions. Direct model authentication supports API
keys, OAuth and configured workload identity; Bedrock, Vertex and Foundry use their
provider environment contracts. Provider flags are mutually exclusive. Fork PR
configuration is restored from the trusted base; workflows must account for token
permissions and unavailable fork secrets/OIDC. None of the offline repros require
an Anthropic or Kimi API key.

`base-action/src/parse-sdk-options.ts` translates arguments/settings into SDK
options. `run-claude-sdk.ts` consumes public SDK messages and writes an execution
artifact; structured output is a separate optional result contract. Progress and
summary formatting cannot prove semantic task success. This is the same distinction
the plugin maintains between observed events, deterministic findings and labels.

## Candidate review and duplicate checks

| Issue                                                                 | Candidate                                    | Decision / existing PR                                                                            |
| --------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [#1852](https://github.com/anthropics/claude-code-action/issues/1852) | Background subagents lost after first result | Reproduced; [#1861](https://github.com/anthropics/claude-code-action/pull/1861), also #1500/#1532 |
| [#1854](https://github.com/anthropics/claude-code-action/issues/1854) | Log body timeout returns empty success       | Reproduced; [#1855](https://github.com/anthropics/claude-code-action/pull/1855)                   |
| [#1841](https://github.com/anthropics/claude-code-action/issues/1841) | MCP errors lose text in summary              | Reproduced; [#1842](https://github.com/anthropics/claude-code-action/pull/1842), #1846            |
| [#1845](https://github.com/anthropics/claude-code-action/issues/1845) | Printable Unicode entities dropped           | Existing #1847                                                                                    |
| [#1843](https://github.com/anthropics/claude-code-action/issues/1843) | GHES branch links use wrong host             | Existing #1844                                                                                    |
| [#1839](https://github.com/anthropics/claude-code-action/issues/1839) | URL query equals/path spaces corrupted       | Existing #1840                                                                                    |
| [#1832](https://github.com/anthropics/claude-code-action/issues/1832) | WIF refresh writes after stop                | Existing #1831, #1620                                                                             |
| [#1825](https://github.com/anthropics/claude-code-action/issues/1825) | Delegated task session hangs                 | Lifecycle overlap; existing timeout/background PRs #1863/#1861                                    |
| [#1823](https://github.com/anthropics/claude-code-action/issues/1823) | Comment PATCH denied but run is green        | No independent Action root cause established; permission denials do not prove runtime malfunction |
| [#1819](https://github.com/anthropics/claude-code-action/issues/1819) | Unbounded review diff context                | Existing #1820/#1826                                                                              |
| [#1817](https://github.com/anthropics/claude-code-action/issues/1817) | Installer succeeds without executable        | Existing #1848/#1260                                                                              |
| [#1798](https://github.com/anthropics/claude-code-action/issues/1798) | Trigger extraction mid-token mismatch        | Existing #1799/#1812                                                                              |
| [#1796](https://github.com/anthropics/claude-code-action/issues/1796) | One malformed buffer line loses comments     | Existing #1797/#1813/#1675                                                                        |
| [#1795](https://github.com/anthropics/claude-code-action/issues/1795) | maxTurns and num_turns differ                | Existing #1806/#1814/#1762                                                                        |
| [#1788](https://github.com/anthropics/claude-code-action/issues/1788) | Agent mode progress comment missing          | Existing #1815                                                                                    |
| [#1781](https://github.com/anthropics/claude-code-action/issues/1781) | Sticky lookup first page only                | Existing #1782                                                                                    |
| [#1779](https://github.com/anthropics/claude-code-action/issues/1779) | Unsanitized user request artifact            | Existing #1780                                                                                    |
| [#1768](https://github.com/anthropics/claude-code-action/issues/1768) | stat misses symlinks                         | Existing #1769/#1808/#1200                                                                        |

Additional code-led candidates were rejected: case-sensitive actor filters are
explicitly covered as current behavior in the suite, so changing that is a policy
change rather than an established bug. Falsy root structured-output values were
not demonstrated as a supported SDK/CLI schema contract. Neither warrants a speculative PR.

## Reproduction and root causes

The [reproduction harness](upstream/candidate-reproductions.test.ts) makes three
expected assertions fail on the unmodified baseline. It uses synthetic public
SDK messages, a loopback streaming HTTP server, and an MCP text-block fixture.
No private CLI interface, real reasoning/transcript, cloud model call or GitHub
write is involved. Run from this plugin directory after installing the upstream
checkout's dependencies:

```bash
CLAUDE_ACTION_CHECKOUT=/path/to/claude-code-action bun test docs/upstream/candidate-reproductions.test.ts
```

This intentionally failing research harness is outside `npm test`.

| Candidate | Expected                                         | Actual measured                                       |
| --------- | ------------------------------------------------ | ----------------------------------------------------- |
| #1852     | Consume background notification and final `DONE` | `success`, final `WAITING`, only 3 messages consumed  |
| #1854     | Reject a timeout after partial body arrival      | Resolved success; `size_bytes: 0`                     |
| #1841     | Summary contains the tool's error text           | Summary contains `[object Object]`; error text absent |

**#1852:** A first turn result triggers an unconditional iterator break. Pending
task messages never reach the artifact or subsequent result selection. The runner
reports success before delegated work is represented. Merely removing the break
can reintroduce hangs; task-state handling needs a termination guard. The fixture
demonstrates the consumer behavior, not a fresh live-model background-task run.

**#1854:** The timeout aborts Octokit's body read. The installed request dependency
can convert that body-read rejection to an empty string, so the surrounding function
writes an empty file and returns success. A rejecting mocked client alone misses
this case; the loopback server exercises the real client. A fix needs to preserve
timeout/error state at the caller boundary and avoid blessing a truncated body.

**#1841:** The error branch interpolates a content array directly, while the success
branch uses the structured-content formatter. Text-block objects stringify without
their text. The failed summary hides diagnostic evidence although the execution
artifact still contains it. Reusing the structured renderer is already proposed upstream.

No After/PASS result or authored fix is claimed: duplicating those existing repairs
would fail the project's contribution criterion. The internal root-cause record
is `.tmp/claude_action_root_cause.md` in the local workspace.

## Checks and follow-up

Upstream baseline typecheck and formatting pass. The complete Windows Bun suite
recorded **920 pass, 46 fail, 966 tests across 57 files**, in 209.33 seconds. These
are the unmodified baseline's Windows failures, including temporary filesystem,
restore-config setup timeouts, SSH permission expectations and WIF fixtures. They
are not presented as a passing fix suite. Because no Action
runtime change was authored, no own fork workflow or upstream PR was created.

A weekly follow-up checks current main, existing repair PRs and new reliability
issues. It stays quiet without meaningful changes and reports a candidate only
when a reproducible, substantive, non-duplicate contribution is available.
