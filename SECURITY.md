# Security and privacy

Report suspected vulnerabilities privately through this repository's GitHub
security advisory workflow. Do not attach credentials, original prompts,
transcripts, source, or raw secret-bearing logs to public issues.

V0.1 is local-only. Hooks never issue network requests or invoke an LLM. The optional
analyst uses Claude's configured provider only when explicitly requested. See
[privacy](docs/privacy.md) for what is retained and its limitations.

Storage identifiers are keyed hashes, filenames are validated, symlink paths are
rejected, writes are locked and flushed, and reports escape values with a restrictive
CSP. The journal is not a tamper-proof audit log. Another process with your user
permissions can alter it; path checks do not defend against a malicious same-user
process racing filesystem operations. Windows uses inherited user ACLs; POSIX
directories/files request 0700/0600.
