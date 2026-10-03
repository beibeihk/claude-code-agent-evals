import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalize,
  analyze,
  html,
  evalCase,
  redact,
  compileCustom,
} from "../bin/library.mjs";
import { events, config, base, key, stop } from "./helpers.mjs";
const secrets = [
  "sk-ant-api03-FAKE_123456789abcdef",
  "ghp_FAKE123456789abcdefghijk",
  "github_pat_FAKE123456789_abcdefgh",
  "AKIAABCDEFGHIJKLMNOP",
  "AIzaFAKE123456789abcdefghijklmnop",
  "eyJfake.eyJpayload.fakesignature",
  "FAKE_BEARER_123456789",
  "FAKE_AWS_SECRET_123456789",
  "FAKE_AZURE_SECRET_123456789",
  "FAKE_GOOGLE_PATH_123456789",
  "FAKE_COOKIE_123456789",
  "FAKE_PASSWORD_123456789",
  "FAKE_PRIVATE_KEY_123456789",
  "CUSTOMSECRET_ABCDEFGHIJKLMNOP",
];
const payload = {
  tokens: secrets.slice(0, 6),
  headers:
    "Authorization: Bearer " + secrets[6] + "\nCookie: session=" + secrets[10],
  AWS_SECRET_ACCESS_KEY: secrets[7],
  AZURE_CLIENT_SECRET: secrets[8],
  GOOGLE_APPLICATION_CREDENTIALS: secrets[9],
  password: secrets[11],
  pem:
    "-----BEGIN RSA PRIVATE KEY-----\n" +
    secrets[12] +
    "\n-----END RSA PRIVATE KEY-----",
  custom: secrets[13],
  nested: [{ client_secret: secrets[8] }],
  thinking: "FORBIDDEN_REASONING",
  scratchpad: "FORBIDDEN_SCRATCHPAD",
};
test("14 fake secrets absent from opt-in trace, HTML and eval case", () => {
  const options = {
    ...config,
    captureContent: true,
    customRedactions: ["CUSTOMSECRET_[A-Z]{16}"],
  };
  const trace = analyze(
    events(
      [
        {
          hook_event_name: "PostToolUse",
          tool_name: "Bash",
          tool_input: { command: "node --test" },
          tool_response: payload,
        },
        stop,
      ],
      options,
    ),
    options,
  );
  const outputs = [
    JSON.stringify(trace),
    html(trace),
    JSON.stringify(evalCase(trace)),
  ];
  for (const output of outputs)
    for (const secret of [
      ...secrets,
      "FORBIDDEN_REASONING",
      "FORBIDDEN_SCRATCHPAD",
    ])
      assert.ok(!output.includes(secret), secret);
});
test("default metadata-only drops prompt, source, output, error, paths and unknown fields", () => {
  const e = normalize(
    {
      ...base,
      hook_event_name: "PostToolUse",
      tool_name: "Read",
      tool_input: {
        file_path: "/secret-source.ts",
        content: "SOURCE_SENTINEL",
      },
      tool_response: "OUTPUT_SENTINEL",
      prompt: "PROMPT_SENTINEL",
      last_assistant_message: "MESSAGE_SENTINEL",
      extra: "EXTRA_SENTINEL",
    },
    key,
    config,
  );
  const text = JSON.stringify(e);
  for (const value of [
    "SOURCE_SENTINEL",
    "OUTPUT_SENTINEL",
    "PROMPT_SENTINEL",
    "MESSAGE_SENTINEL",
    "EXTRA_SENTINEL",
    "/secret-source.ts",
    base.transcript_path,
  ])
    assert.ok(!text.includes(value));
  assert.equal(e.content, undefined);
});
test("sensitive file and shell content suppressed even with opt-in", () => {
  for (const tool_input of [
    { file_path: "/repo/.env.local" },
    { file_path: "/repo/id_rsa" },
    { command: "cat .env" },
  ]) {
    const e = normalize(
      {
        ...base,
        hook_event_name: "PostToolUse",
        tool_name: "Read",
        tool_input,
        tool_response: "UNKNOWN_SECRET_VALUE",
      },
      key,
      { ...config, captureContent: true },
    );
    assert.equal(e.content, undefined);
    assert.equal(e.metadata.suppressed_content, true);
  }
});
test("HTML escapes hostile imported values, CSP and no executable scripts", () => {
  const trace = analyze(events([stop]), config);
  trace.findings.push({
    id: "x",
    type: "x",
    severity: "info",
    event_seqs: [1],
    message: "<script>alert(1)</script>",
    evidence: { payload: "</pre><img src=x onerror=alert(1)>" },
  });
  const output = html(trace);
  assert.ok(output.includes("&lt;script&gt;"));
  assert.ok(!output.includes("<script>"));
  assert.ok(output.includes("default-src 'none'"));
});
test("regex config cannot introduce catastrophic backtracking", () => {
  for (const regex of [
    "(a+)+$",
    ".*token.*",
    "[a]{1,999}",
    "[a]{10,1}",
    "[a]{1,3}[a]{1,3}",
  ])
    assert.throws(() => compileCustom(regex));
  assert.equal(
    redact("CUSTOMSECRET_ABCD", [compileCustom("CUSTOMSECRET_[A-Z]{4}")]),
    "[REDACTED]",
  );
});
