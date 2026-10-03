# Privacy model

Metadata-only is the default. The recorder retains hook name, receipt timestamp,
sequence, keyed session/workspace/tool identifiers, tool name, observed outcome,
payload sizes, keyed hashes, conservative verification category, file type and
known lifecycle fields. It does not retain prompts, code, shell output, errors,
absolute paths or assistant prose. Keyed hashes resist offline dictionary attacks
on an exported trace as long as the local `hash-key` remains private. Hashes are
not comparable across stores. Size and timing metadata can still reveal patterns.

V1 never reads `transcript_path`, `agent_transcript_path`, scratchpads, databases,
reasoning blocks or private APIs. Unknown hook fields are discarded. `thinking`,
`reasoning`, chain-of-thought and scratchpad keys are excluded even on content opt-in.

Run `node "<plugin>/bin/agent-evals.mjs" config-init`, then explicitly edit the local
`config.json` to set `captureContent: true`. Every event records the active capture
mode; changing the setting does not retroactively remove old content. Opt-in content
is redacted before writing. Sensitive file operations (`.env`, credential files,
PEM keys, SSH private keys) suppress both input and output content. Only allowlisted
public input/result/prompt/error/assistant-message fields can be retained.

Redaction covers Anthropic/GitHub/AWS/Google token patterns, JWTs, bearer tokens,
authorization/cookie headers, passwords, Azure connection-string fields, environment
assignments and private keys. Key names containing secret/token/password/credential
are fully masked. These patterns cannot guarantee removal of every secret, arbitrary
encoding or unknown format. Keep metadata-only for sensitive work.

`customRedactions` accepts at most 20 restricted regexes. Example:
`CUSTOMSECRET_[A-Z0-9]{16,32}`. Use a literal prefix/suffix and at most one character
class with bounded repetition (1..256); groups, alternation, wildcards and escapes
are rejected to prevent pathological hook CPU use. Invalid config skips recording
with a generic warning; it never silently enables content capture.

Data uses documented `CLAUDE_PLUGIN_DATA`, outside the repository and plugin cache.
For `--plugin-dir`/older clients lacking it, the explicit fallback is
`~/.claude/plugins/data/agent-evals-local`. `AGENT_EVALS_DATA_DIR` overrides it for
isolated runs. CLI commands through Bash need the expanded data path because Bash
does not inherit plugin path variables. Export files remain local; no upload code
exists. The optional analyst sends its supplied redacted report to the user's
configured Claude provider when invoked, so use it only with consent.

Use `claude plugin uninstall agent-evals@beibeihk-agent-evals --keep-data` if you want
to preserve traces. See the current official CLI docs for uninstall data semantics.
The fallback/override directory is user-managed and is not deleted by uninstall.
Never publish `hash-key`, raw traces with content, or configuration containing secrets.
