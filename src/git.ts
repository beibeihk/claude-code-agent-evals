import { spawnSync } from "node:child_process";
export function workspaceDiff(cwd: string): Record<string, unknown> {
  // Explicit CLI-only, read-only snapshot. Disable external diff/textconv and
  // hooks. No content, paths or commit messages enter the report.
  const run = (args: string[]) =>
    spawnSync(
      "git",
      ["-c", "core.hooksPath=", "-c", "diff.external=", ...args],
      {
        cwd,
        encoding: "utf8",
        timeout: 5000,
        maxBuffer: 1024 * 1024,
        env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_EXTERNAL_DIFF: "" },
      },
    );
  const diff = run([
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--numstat",
    "-z",
    "HEAD",
    "--",
  ]);
  if (diff.error || diff.status !== 0)
    return {
      available: false,
      reason: "Git HEAD diff unavailable or exceeded bound",
      attribution: "workspace snapshot only",
    };
  const records = diff.stdout.split("\0").filter(Boolean);
  let added = 0,
    deleted = 0,
    files = 0,
    tests = 0,
    source = 0,
    binary = 0;
  for (let i = 0; i < records.length; i++) {
    const match = /^(\d+|-)\t(\d+|-)\t(.*)$/s.exec(records[i]!);
    if (!match) continue;
    files++;
    let file = match[3]!;
    if (!file) {
      i += 2;
      file = records[i] ?? "";
    }
    if (match[1] === "-" || match[2] === "-") binary++;
    else {
      added += Number(match[1]);
      deleted += Number(match[2]);
    }
    if (/(?:^|\/)(?:tests?|__tests__)\/|\.(?:test|spec)\./i.test(file)) tests++;
    else if (/\.(?:[cm]?[jt]sx?|py|rs|go|java|c|cpp|cs|rb|gd)$/i.test(file))
      source++;
  }
  const untracked = run(["ls-files", "--others", "--exclude-standard", "-z"]);
  return {
    available: true,
    attribution:
      "current workspace diff against HEAD; includes pre-existing and external changes",
    observed_at: new Date().toISOString(),
    files_touched: files,
    lines_added: added,
    lines_deleted: deleted,
    test_files_changed: tests,
    source_files_changed: source,
    binary_files: binary,
    untracked_file_count:
      untracked.status === 0
        ? untracked.stdout.split("\0").filter(Boolean).length
        : null,
    untracked_lines_included: false,
  };
}
