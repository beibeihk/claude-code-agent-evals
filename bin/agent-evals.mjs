var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/shell-quote/quote.js
var require_quote = __commonJS({
  "node_modules/shell-quote/quote.js"(exports, module) {
    "use strict";
    var OPS = (
      /** @type {const} */
      [
        "||",
        "&&",
        ";;&",
        ";;",
        ";&",
        "|&",
        "<(",
        ">(",
        "<<<",
        "<<-",
        "<<",
        ">>",
        ">&",
        ">|",
        "&>>",
        "&>",
        "<&",
        "<>",
        "&",
        ";",
        "(",
        ")",
        "|",
        "<",
        ">"
      ]
    );
    var LINE_TERMINATORS = /[\n\r\u2028\u2029]/;
    var GLOB_SHELL_SPECIAL = /[\s#!"$&'():;<=>@\\^`|~]/g;
    module.exports = function quote(xs) {
      var sawComment = false;
      return xs.map(function(s) {
        if (sawComment && typeof s === "string" && LINE_TERMINATORS.test(s)) {
          throw new TypeError("a token after a `comment` must not contain line terminators");
        }
        if (s === "") {
          return (
            /** @type {const} */
            "''"
          );
        }
        if (s && typeof s === "object") {
          if ("op" in s && s.op === "glob") {
            if (typeof s.pattern !== "string") {
              throw new TypeError("glob token requires a string `pattern`");
            }
            if (LINE_TERMINATORS.test(s.pattern)) {
              throw new TypeError("glob `pattern` must not contain line terminators");
            }
            if (s.pattern === "") {
              return (
                /** @type {const} */
                "''"
              );
            }
            return s.pattern.replace(GLOB_SHELL_SPECIAL, "\\$&");
          }
          if ("op" in s && typeof s.op === "string") {
            if (OPS.indexOf(s.op) < 0) {
              throw new TypeError("invalid `op` value: " + JSON.stringify(s.op));
            }
            return s.op.replace(/[\s\S]/g, "\\$&");
          }
          if ("comment" in s && typeof s.comment === "string") {
            if (LINE_TERMINATORS.test(s.comment)) {
              throw new TypeError("`comment` must not contain line terminators");
            }
            sawComment = true;
            return "#" + s.comment;
          }
          throw new TypeError("unrecognized object token shape");
        }
        if (/'/.test(s) && /!/.test(s)) {
          return "'" + s.replace(/'/g, `'"'"'`) + "'";
        }
        if (/["\s\\]/.test(s) && !/'/.test(s)) {
          return "'" + s + "'";
        }
        if (/["'\s]/.test(s)) {
          return '"' + s.replace(/(["\\$`])/g, "\\$1") + '"';
        }
        return String(s).replace(/([A-Za-z]:)?([#!"$&'()*,:;<=>?@[\\\]^`{|}~])/g, "$1\\$2");
      }).join(" ");
    };
  }
});

// node_modules/shell-quote/parse.js
var require_parse = __commonJS({
  "node_modules/shell-quote/parse.js"(exports, module) {
    "use strict";
    var CONTROL = (
      /** @type {const} */
      "(?:" + /** @type {const} */
      [
        "\\|\\|",
        "\\&(?:\\&|>>?)",
        // `&&`, `&>`, and `&>>`
        ";;\\&?",
        // `;;` and `;;&`
        "[;|]\\&",
        // `;&` and `|&`
        "\\<\\(",
        "\\<\\<\\<",
        "\\<\\<-",
        "\\<\\<(?!\\()",
        // `<<(` stays `<` and `<(`, as zsh reads it; other shells reject it
        ">>",
        ">[&|(]",
        // `>&`, `>|`, and `>(`
        "<[&>]",
        // `<&` and `<>`
        "[&;()|<>]"
      ].join(
        /** @type {const} */
        "|"
      ) + /** @type {const} */
      ")"
    );
    var controlRE = new RegExp("^" + CONTROL + "$");
    var META = (
      /** @type {const} */
      "|&;()<> \\t"
    );
    var SINGLE_QUOTE = (
      /** @type {const} */
      "'([^']*?)'"
    );
    var ANSI_C_BODY = "(?:\\\\[\\s\\S]|[^\\\\'])*?";
    var ANSI_C_QUOTE = "\\$'" + ANSI_C_BODY + "'";
    var ansiCAt = new RegExp("\\$'" + ANSI_C_BODY + "(?:(')|\\\\?$)", "g");
    var ANSI_C_LETTERS = "abeEfnrtv";
    var ANSI_C_CHARS = "\x07\b\x1B\x1B\f\n\r	\v";
    var hash = /^#$/;
    var SQ = (
      /** @type {const} */
      "'"
    );
    var DQ = (
      /** @type {const} */
      '"'
    );
    var DS = (
      /** @type {const} */
      "$"
    );
    var TOKEN = "";
    var mult = (
      /** @type {const} */
      4294967296
    );
    for (i = 0; i < 4; i++) {
      TOKEN += (mult * Math.random()).toString(16);
    }
    var i;
    var startsWithToken = new RegExp("^" + TOKEN);
    function matchAll(s, r) {
      var origIndex = r.lastIndex;
      var matches = [];
      var matchObj;
      while (matchObj = r.exec(s)) {
        matches[matches.length] = matchObj;
        if (r.lastIndex === matchObj.index) {
          r.lastIndex += 1;
        }
      }
      r.lastIndex = origIndex;
      return matches;
    }
    function getVar(env, pre, key) {
      var r = typeof env === "function" ? env(key) : env[key];
      if (typeof r === "undefined" && key != "") {
        r = "";
      } else if (typeof r === "undefined") {
        r = "$";
      }
      if (typeof r === "object") {
        return pre + TOKEN + JSON.stringify(r) + TOKEN;
      }
      return pre + r;
    }
    var ansiCEscape = /\\([0-7]{1,3}|x[\dA-Fa-f]{1,2}|u[\dA-Fa-f]{1,4}|U[\dA-Fa-f]{1,8}|c(?:\\\\|[\s\S])|[abeEfnrtv\\'"?])/g;
    function expandAnsiCEscape(m, escape) {
      var kind = escape.charAt(0);
      if (kind === "c") {
        var ctrl = escape.charAt(1);
        return ctrl === "?" ? "\x7F" : String.fromCharCode(ctrl.charCodeAt(0) & 31);
      }
      if (kind === "x" || kind === "u" || kind === "U") {
        var cp = parseInt(escape.slice(1), 16);
        if (cp > 1114111) {
          return m;
        }
        return String.fromCharCode.apply(null, cp > 65535 ? [55232 + (cp >> 10), 56320 + (cp & 1023)] : [cp]);
      }
      if (kind >= "0" && kind <= "7") {
        return String.fromCharCode(parseInt(escape, 8) & 255);
      }
      var letter = ANSI_C_LETTERS.indexOf(escape);
      return letter < 0 ? escape : ANSI_C_CHARS.charAt(letter);
    }
    function expandAnsiC(body) {
      return body.replace(ansiCEscape, expandAnsiCEscape).split("\0")[0];
    }
    function closesAnsiC(s, i2) {
      ansiCAt.lastIndex = i2;
      return !!/** @type {RegExpExecArray} */
      ansiCAt.exec(s)[1];
    }
    function parseInternal(string, env, opts) {
      if (!opts) {
        opts = {};
      }
      var BS = opts.escape || "\\";
      var ifs = opts.splitUnquoted === true ? " 	\n" : typeof opts.splitUnquoted === "string" ? opts.splitUnquoted : "";
      var BAREWORD = "(\\" + BS + `['"$\\` + BS + META + "]|\\$\\$|\\$(?!" + ANSI_C_QUOTE.slice(2) + `)|[^\\s'"$` + META + "])+";
      var DOUBLE_QUOTE = '"(?:\\' + BS + '[\\s\\S]|[^"\\' + BS + '])*"';
      var chunker = new RegExp([
        "(" + CONTROL + ")",
        // control chars
        "(" + ANSI_C_QUOTE + "|" + BAREWORD + "|" + DOUBLE_QUOTE + "|" + SINGLE_QUOTE + ")+"
      ].join("|"), "g");
      var matches = matchAll(string, chunker);
      if (matches.length === 0) {
        return [];
      }
      if (!env) {
        env = {};
      }
      var commented = false;
      return matches.map(function(match) {
        var s = match[0];
        if (!s || commented) {
          return void 0;
        }
        if (controlRE.test(s)) {
          return (
            /** @type {ControlOperator} */
            { op: s }
          );
        }
        var quote = false;
        var esc = false;
        var out = "";
        var words = [];
        var sawQuote = false;
        var pendingNw = null;
        var isGlob = false;
        var i2;
        function parseEnvVar() {
          i2 += 1;
          var varend;
          var varname;
          var char = s.charAt(i2);
          if (char === "{") {
            i2 += 1;
            if (s.charAt(i2) === "}") {
              throw new Error("Bad substitution: " + s.slice(i2 - 2, i2 + 1));
            }
            var depth = 1;
            varend = i2;
            while (depth > 0 && varend < s.length) {
              if (s.charAt(varend) === "{" && s.charAt(varend - 1) === "$") {
                depth += 1;
              } else if (s.charAt(varend) === "}") {
                depth -= 1;
              }
              varend += 1;
            }
            if (depth !== 0) {
              throw new Error("Bad substitution: " + s.slice(i2));
            }
            varend -= 1;
            varname = s.slice(i2, varend);
            i2 = varend;
          } else if (/[*@#?$!-]/.test(char)) {
            varname = char;
          } else {
            var slicedFromI = s.slice(i2);
            varend = slicedFromI.match(/[^\w\d_]/);
            if (!varend) {
              varname = slicedFromI;
              i2 = s.length;
            } else {
              varname = slicedFromI.slice(0, varend.index);
              i2 += /** @type {number} */
              varend.index - 1;
            }
          }
          return getVar(
            /** @type {NonNullable<typeof env>} */
            env,
            "",
            varname
          );
        }
        function flushRun() {
          if (pendingNw === null) {
            return;
          }
          if (pendingNw === 0) {
            if (out !== "") {
              words[words.length] = out;
              out = "";
            }
          } else {
            words[words.length] = out;
            out = "";
            for (var fe = 1; fe < pendingNw; fe += 1) {
              words[words.length] = "";
            }
          }
          pendingNw = null;
        }
        for (i2 = 0; i2 < s.length; i2++) {
          var c = s.charAt(i2);
          if (ifs && c !== DS) {
            flushRun();
          }
          isGlob = isGlob || !quote && (c === "*" || c === "?");
          if (esc) {
            out += c;
            esc = false;
          } else if (quote) {
            if (c === quote) {
              quote = false;
            } else if (quote == SQ) {
              out += c;
            } else {
              if (c === BS) {
                i2 += 1;
                c = s.charAt(i2);
                if (c === DQ || c === BS || c === DS) {
                  out += c;
                } else {
                  out += BS + c;
                }
              } else if (c === DS) {
                out += parseEnvVar();
              } else {
                out += c;
              }
            }
          } else if (c === DQ || c === SQ) {
            quote = c;
            sawQuote = true;
          } else if (controlRE.test(c)) {
            return (
              /** @type {ControlOperator} */
              { op: s }
            );
          } else if (hash.test(c)) {
            commented = true;
            var commentObj = { comment: string.slice(match.index + i2 + 1) };
            if (out.length) {
              return (
                /** @type {const} */
                [out, commentObj]
              );
            }
            return (
              /** @type {const} */
              [commentObj]
            );
          } else if (c === BS) {
            esc = true;
          } else if (c === DS && s.charAt(i2 + 1) === SQ && closesAnsiC(s, i2)) {
            flushRun();
            sawQuote = true;
            out += expandAnsiC(s.slice(i2 + 2, ansiCAt.lastIndex - 1));
            i2 = ansiCAt.lastIndex - 1;
          } else if (c === DS) {
            var value = parseEnvVar();
            if (!ifs) {
              out += value;
            } else {
              for (var vi = 0; vi < value.length; vi += 1) {
                var vc = value.charAt(vi);
                if (ifs.indexOf(vc) < 0) {
                  flushRun();
                  out += vc;
                } else if (pendingNw === null) {
                  pendingNw = vc === " " || vc === "	" || vc === "\n" ? 0 : 1;
                } else if (vc !== " " && vc !== "	" && vc !== "\n") {
                  pendingNw += 1;
                }
              }
            }
          } else {
            out += c;
          }
        }
        if (isGlob) {
          return (
            /** @type {GlobPattern} */
            { op: "glob", pattern: out }
          );
        }
        if (ifs) {
          if (pendingNw !== null && pendingNw > 0) {
            words[words.length] = out;
            out = "";
            for (var te = 1; te < pendingNw; te += 1) {
              words[words.length] = "";
            }
          }
          if (out !== "" || sawQuote && words.length === 0) {
            words[words.length] = out;
          }
          return words;
        }
        return out;
      }).reduce(
        function(prev, arg) {
          if (typeof arg === "undefined") {
            return prev;
          }
          [].concat(arg).forEach(function(entry) {
            prev[prev.length] = entry;
          });
          return prev;
        },
        /** @type {ParseEntry[]} */
        []
      );
    }
    module.exports = function parse3(s, env, opts) {
      var mapped = parseInternal(s, env, opts);
      if (typeof env !== "function") {
        return mapped;
      }
      return mapped.reduce(
        function(acc, s2) {
          if (typeof s2 === "object") {
            acc[acc.length] = s2;
            return acc;
          }
          var xs = s2.split(RegExp("(" + TOKEN + ".*?" + TOKEN + ")", "g"));
          if (xs.length === 1) {
            acc[acc.length] = xs[0];
            return acc;
          }
          xs.filter(Boolean).forEach(function(x) {
            acc[acc.length] = startsWithToken.test(x) ? JSON.parse(x.split(TOKEN)[1]) : x;
          });
          return acc;
        },
        /** @type {ParseEntry[]} */
        []
      );
    };
  }
});

// node_modules/shell-quote/index.js
var require_shell_quote = __commonJS({
  "node_modules/shell-quote/index.js"(exports) {
    "use strict";
    exports.quote = require_quote();
    exports.parse = require_parse();
  }
});

// src/cli.ts
import { existsSync as existsSync3, writeFileSync as writeFileSync2 } from "node:fs";
import { join as join3 } from "node:path";

// src/analyze.ts
var EDIT_TOOLS = /* @__PURE__ */ new Set(["Edit", "Write", "NotebookEdit", "MultiEdit"]);
function analyze(events, config) {
  const first = events[0];
  const last = events.at(-1);
  if (!first || !last) throw new Error("Empty trace");
  const findings = [];
  const limitations = [
    "Receipt sequence orders recorder writes, not concurrent tool execution. Timestamps are hook receipt times.",
    "No hidden reasoning or transcripts are read. Stop is a turn boundary, not proof of task completion.",
    "Observation can miss external/background tools, non-hooked changes and process termination.",
    "Cancellation/denial are separate from execution failure. PermissionDenied covers auto mode only.",
    "Verification recognition covers a conservative set of foreground shell commands; no assertion count or coverage is inferred."
  ];
  const calls = [];
  const pending = /* @__PURE__ */ new Map();
  const correlationKey = (e) => e.correlation_id ? (e.agent_id ?? "main") + ":" + e.correlation_id : void 0;
  let callEvents = events.filter((e) => e.source_hook === "PreToolUse");
  let resultEvents = events.filter(
    (e) => ["PostToolUse", "PostToolUseFailure", "PermissionDenied"].includes(
      e.source_hook
    )
  );
  const completedIds = /* @__PURE__ */ new Set();
  const byCallSeq = /* @__PURE__ */ new Map();
  const duplicates = [];
  for (const e of events) {
    const key = correlationKey(e);
    if (e.source_hook === "PreToolUse") {
      if (key && pending.has(key)) {
        duplicates.push(e.seq);
        continue;
      }
      const call = {
        id: key ?? "unpaired:" + e.seq,
        tool_name: e.tool_name ?? "unknown",
        agent_id: e.agent_id,
        call_seq: e.seq,
        outcome: "unknown",
        duration_ms: null,
        duration_source: "unavailable"
      };
      calls.push(call);
      byCallSeq.set(e.seq, call);
      if (key) pending.set(key, call);
    }
  }
  for (const e of resultEvents) {
    const key = correlationKey(e);
    if (key && completedIds.has(key)) {
      duplicates.push(e.seq);
      continue;
    }
    if (key) completedIds.add(key);
    let call = key ? pending.get(key) : void 0;
    if (call && call.tool_name !== e.tool_name) {
      limitations.push(
        "Tool name mismatch for correlation at event " + e.seq + "; result kept unpaired."
      );
      call = void 0;
    }
    if (!call) {
      call = {
        id: "orphan:" + e.seq,
        tool_name: e.tool_name ?? "unknown",
        agent_id: e.agent_id,
        outcome: "unknown",
        duration_ms: null,
        duration_source: "unavailable"
      };
      calls.push(call);
    }
    call.result_seq = e.seq;
    call.outcome = e.outcome ?? "unknown";
    if (e.duration_ms !== void 0) {
      call.duration_ms = e.duration_ms;
      call.duration_source = "hook";
    } else if (call.call_seq) {
      const start = events[call.call_seq - 1];
      const interval = start ? Date.parse(e.timestamp) - Date.parse(start.timestamp) : -1;
      if (interval >= 0) {
        call.duration_ms = interval;
        call.duration_source = "observed_interval";
      }
    }
  }
  if (duplicates.length)
    limitations.push(
      "Duplicate correlation events excluded from tool outcomes: " + duplicates.join(", ")
    );
  callEvents = callEvents.filter((e) => !duplicates.includes(e.seq));
  resultEvents = resultEvents.filter((e) => !duplicates.includes(e.seq));
  if (calls.some((c) => !c.call_seq || !c.result_seq))
    limitations.push(
      "Trace has unmatched tool calls/results; incomplete evidence is included in metrics."
    );
  const emit = (type, severity, seqs, message, evidence) => {
    findings.push({
      id: type + "-" + (findings.filter((f) => f.type === type).length + 1),
      type,
      severity,
      event_seqs: seqs,
      message,
      evidence
    });
  };
  const time = (e) => Date.parse(e.timestamp);
  const sameAgent = (a, b) => a.agent_id === b.agent_id;
  const groups = /* @__PURE__ */ new Map();
  for (const e of callEvents) {
    if (!e.tool_name || !e.metadata.input_hash) continue;
    const key = (e.agent_id ?? "main") + ":" + e.tool_name + ":" + e.metadata.input_hash;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(e);
  }
  for (const group of groups.values()) {
    let start = 0;
    let reportedRepeat = false;
    let reportedRetry = false;
    let retryStart = 0;
    for (let end = 0; end < group.length; end++) {
      const current = group[end];
      while (start < end && time(current) - time(group[start]) > config.windowMs)
        start++;
      if (end - start + 1 >= config.repeatedCalls && !reportedRepeat) {
        emit(
          "F01",
          "info",
          group.slice(start, end + 1).map((e) => e.seq),
          "Equivalent tool arguments repeated within the configured window.",
          {
            threshold: config.repeatedCalls,
            window_ms: config.windowMs,
            tool: current.tool_name
          }
        );
        reportedRepeat = true;
      }
      if (end > 0) {
        const previous = byCallSeq.get(group[end - 1].seq);
        if (!previous?.result_seq || previous.result_seq >= current.seq || !["failure", "denied"].includes(previous.outcome))
          retryStart = end;
      }
      const effectiveStart = Math.max(start, retryStart);
      if (end - effectiveStart + 1 >= config.excessiveRetries && !reportedRetry) {
        emit(
          "F03",
          "warning",
          group.slice(effectiveStart, end + 1).map((e) => e.seq),
          "Equivalent failed/denied invocation retried above the configured threshold.",
          { threshold: config.excessiveRetries, window_ms: config.windowMs }
        );
        reportedRetry = true;
      }
    }
  }
  const byAgent = /* @__PURE__ */ new Map();
  for (const e of resultEvents) {
    const key = e.agent_id ?? "main";
    if (!byAgent.has(key)) byAgent.set(key, []);
    byAgent.get(key).push(e);
  }
  for (const group of byAgent.values()) {
    let loop = [];
    let reported = false;
    for (const e of group) {
      const prev = loop.at(-1);
      if (e.outcome !== "failure") {
        loop = [];
        reported = false;
        continue;
      }
      if (!prev || prev.tool_name !== e.tool_name || time(e) - time(prev) > config.windowMs) {
        loop = [];
        reported = false;
      }
      loop.push(e);
      if (loop.length >= config.failureLoop && !reported) {
        emit(
          "F02",
          "warning",
          loop.map((e2) => e2.seq),
          "Consecutive observed failures of the same tool.",
          {
            threshold: config.failureLoop,
            tool: e.tool_name,
            error_categories: loop.map((x) => x.metadata.error_category)
          }
        );
        reported = true;
      }
    }
  }
  for (const call of calls) {
    if (call.result_seq && call.duration_ms !== null && call.duration_ms > config.longToolMs)
      emit(
        "F04",
        "warning",
        [call.call_seq, call.result_seq].filter(
          (n) => n !== void 0
        ),
        "Tool duration exceeds the user-configured warning threshold.",
        {
          duration_ms: call.duration_ms,
          threshold_ms: config.longToolMs,
          duration_source: call.duration_source
        }
      );
  }
  const verification = resultEvents.filter((e) => e.metadata.verification !== void 0).map((e) => ({
    event_seq: e.seq,
    kind: e.metadata.verification,
    outcome: e.metadata.verification_outcome ?? e.outcome ?? "unknown"
  }));
  for (const stop of events.filter(
    (e) => e.source_hook === "Stop" && !e.agent_id
  )) {
    const previousPrompt = events.filter(
      (e) => e.source_hook === "UserPromptSubmit" && e.seq < stop.seq && !e.agent_id
    ).at(-1)?.seq ?? 0;
    const turn = events.filter(
      (e) => e.seq > previousPrompt && e.seq < stop.seq
    );
    const latestTest = turn.filter(
      (e) => e.metadata.verification === "test" && e.event_type === "tool_result" && !e.agent_id
    ).at(-1);
    if (stop.metadata.completion_marker_seen && stop.metadata.background_count === 0 && latestTest !== void 0 && (latestTest?.metadata.verification_outcome ?? latestTest?.outcome) === "failure") {
      emit(
        "F05",
        "warning",
        [latestTest.seq, stop.seq],
        "Explicit completion marker observed while the last visible foreground test failed.",
        {
          completion_protocol: true,
          scope: "current turn / main agent",
          final_goal_outcome: "unknown"
        }
      );
    }
    const edits = turn.filter(
      (e) => EDIT_TOOLS.has(e.tool_name ?? "") && e.source_hook === "PostToolUse" && e.metadata.file_kind === "source"
    );
    const latestEdit = edits.at(-1);
    if (latestEdit && !turn.some(
      (e) => e.seq > latestEdit.seq && e.event_type === "tool_result" && e.metadata.verification !== void 0 && (e.outcome === "success" || e.outcome === "failure")
    )) {
      emit(
        "F06",
        "info",
        [latestEdit.seq, stop.seq],
        "Source edit observed without a recognized verification after the final edit in this turn.",
        {
          scope: "recognized foreground verification",
          task_requires_tests: "unknown"
        }
      );
    }
  }
  const editsByFile = /* @__PURE__ */ new Map();
  for (const e of resultEvents.filter(
    (e2) => e2.source_hook === "PostToolUse" && e2.tool_name === "Edit" && e2.metadata.file_id && e2.metadata.old_hash && e2.metadata.new_hash
  )) {
    const key = (e.agent_id ?? "main") + ":" + e.metadata.file_id;
    if (!editsByFile.has(key)) editsByFile.set(key, []);
    editsByFile.get(key).push(e);
  }
  for (const edits of editsByFile.values()) {
    let chain = [];
    for (const e of edits) {
      const prev = chain.at(-1);
      const reversed = prev && e.metadata.old_hash === prev.metadata.new_hash && e.metadata.new_hash === prev.metadata.old_hash && time(e) - time(prev) <= config.windowMs;
      if (!reversed || prev && resultEvents.some(
        (v) => sameAgent(v, e) && v.seq > prev.seq && v.seq < e.seq && v.metadata.verification && (v.metadata.verification_outcome ?? v.outcome) === "success"
      ))
        chain = [];
      chain.push(e);
      if (chain.length === config.oscillations)
        emit(
          "F07",
          "warning",
          chain.map((v) => v.seq),
          "Exact reverse edits repeated without an intervening successful recognized verification.",
          {
            threshold: config.oscillations,
            file_id: e.metadata.file_id,
            intent: "unknown"
          }
        );
    }
  }
  const denials = /* @__PURE__ */ new Map();
  for (const e of resultEvents.filter(
    (e2) => e2.source_hook === "PermissionDenied" && e2.metadata.input_hash
  )) {
    const key = (e.agent_id ?? "main") + ":" + e.tool_name + ":" + e.metadata.input_hash;
    const group = (denials.get(key) ?? []).filter(
      (x) => time(e) - time(x) <= config.windowMs
    );
    group.push(e);
    denials.set(key, group);
    if (group.length === config.failureLoop)
      emit(
        "F08",
        "warning",
        group.map((v) => v.seq),
        "Equivalent tool denied repeatedly by auto mode.",
        { threshold: config.failureLoop, coverage: "auto mode only" }
      );
  }
  for (const e of resultEvents.filter(
    (e2) => ["Agent", "Task"].includes(e2.tool_name ?? "") && e2.outcome === "failure"
  )) {
    emit(
      "F09",
      "warning",
      [e.seq],
      "Subagent tool invocation explicitly failed; main-task outcome is unknown.",
      { signal: "PostToolUseFailure", subagent_completed: "unknown" }
    );
  }
  for (const compact of events.filter((e) => e.source_hook === "PreCompact")) {
    const following = resultEvents.filter(
      (e) => e.seq > compact.seq && time(e) - time(compact) <= config.windowMs && e.outcome === "failure"
    );
    emit(
      "F10",
      "info",
      [compact.seq, ...following.map((e) => e.seq)],
      "Observed compaction boundary; following failures are temporal correlation only.",
      {
        events_before: compact.seq - 1,
        observed_ms_before: time(compact) - time(first),
        following_failures: following.length,
        causal_claim: false
      }
    );
  }
  const durations = calls.filter((c) => c.duration_ms !== null).map((c) => c.duration_ms).sort((a, b) => a - b);
  const percentile = (q) => durations.length ? durations[Math.max(0, Math.ceil(durations.length * q) - 1)] : null;
  const successful = calls.filter((c) => c.outcome === "success").length;
  const failed = calls.filter((c) => c.outcome === "failure").length;
  const subagents = new Set(
    events.filter((e) => e.source_hook === "SubagentStart").map((e) => e.agent_id ?? "event:" + e.seq)
  );
  return {
    schema_version: first.schema_version,
    session: {
      id: first.session_id,
      workspace_id: first.workspace_id,
      source: "claude-code",
      first_observed: first.timestamp,
      last_observed: last.timestamp,
      ended: events.some((e) => e.source_hook === "SessionEnd")
    },
    events,
    tool_calls: calls,
    findings,
    verification,
    limitations,
    metrics: {
      session_duration_ms: Math.max(
        0,
        Date.parse(last.timestamp) - Date.parse(first.timestamp)
      ),
      tool_call_count: callEvents.length,
      tool_success_count: successful,
      tool_failure_count: failed,
      tool_failure_rate: successful + failed ? failed / (successful + failed) : null,
      tool_cancelled_count: calls.filter((c) => c.outcome === "cancelled").length,
      tool_denied_count: calls.filter((c) => c.outcome === "denied").length,
      unpaired_call_count: calls.filter((c) => !c.result_seq).length,
      orphan_result_count: calls.filter((c) => !c.call_seq).length,
      duplicate_event_count: duplicates.length,
      bash_call_count: callEvents.filter(
        (e) => ["Bash", "PowerShell"].includes(e.tool_name ?? "")
      ).length,
      edit_call_count: callEvents.filter(
        (e) => EDIT_TOOLS.has(e.tool_name ?? "")
      ).length,
      read_call_count: callEvents.filter((e) => e.tool_name === "Read").length,
      search_call_count: callEvents.filter(
        (e) => ["Grep", "Glob"].includes(e.tool_name ?? "")
      ).length,
      tool_duration_p50_ms: percentile(0.5),
      tool_duration_p95_ms: percentile(0.95),
      stop_count: events.filter((e) => e.source_hook === "Stop" && !e.agent_id).length,
      subagent_count: subagents.size,
      compaction_count: events.filter((e) => e.source_hook === "PreCompact").length,
      files_touched: new Set(
        resultEvents.filter(
          (e) => EDIT_TOOLS.has(e.tool_name ?? "") && e.outcome === "success" && e.metadata.file_id
        ).map((e) => e.metadata.file_id)
      ).size
    }
  };
}

// src/config.ts
import { readFileSync as readFileSync2, existsSync as existsSync2 } from "node:fs";
import { join as join2 } from "node:path";

// src/model.ts
var SCHEMA_VERSION = "1.0.0";
var HOOKS = [
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "PostToolUseFailure",
  "PermissionDenied",
  "Stop",
  "StopFailure",
  "SubagentStart",
  "SubagentStop",
  "PreCompact",
  "SessionEnd"
];
function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value : {};
}

// src/privacy.ts
import { createHmac } from "node:crypto";
import { resolve } from "node:path";
function workspaceIdentity(key, path) {
  const absolute = resolve(path);
  return identity(
    key,
    process.platform === "win32" ? absolute.replace(/\\/g, "/") : absolute
  );
}
function workspaceCandidates(key, path) {
  const absolute = resolve(path);
  return [
    .../* @__PURE__ */ new Set([
      workspaceIdentity(key, path),
      identity(key, path),
      identity(key, absolute.replace(/\\/g, "/"))
    ])
  ];
}
var KEY = /(?:secret|token|password|passwd|authorization|cookie|api[_-]?key|credential|private[_-]?key|client[_-]?secret)/i;
var INTERNAL = /^(?:thinking|reasoning|chain[_-]?of[_-]?thought|scratchpad|transcript_path|agent_transcript_path)$/i;
var PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?(?:-----END [A-Z ]*PRIVATE KEY-----|$)/g,
  /\bsk-ant-[A-Za-z0-9_-]{8,}/g,
  /\b(?:gh[pousr]_[A-Za-z0-9]{12,}|github_pat_[A-Za-z0-9_]{12,})/g,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\bAIza[A-Za-z0-9_-]{20,}\b/g,
  /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,
  /\bBearer\s+[^\s'";,]+/gi,
  /\b(?:ANTHROPIC_API_KEY|GITHUB_TOKEN|AWS_(?:SECRET_ACCESS_KEY|SESSION_TOKEN)|GOOGLE_APPLICATION_CREDENTIALS|AZURE_[A-Z_]+|[A-Z_]*(?:API_KEY|ACCESS_TOKEN|CLIENT_SECRET|PASSWORD))\s*[=:]\s*[^\s,;]+/gi,
  /\b(?:authorization|cookie|set-cookie|password|passwd|api[_-]?key|client[_-]?secret|accountkey|sharedaccesssignature|private_key)\s*[=:]\s*[^\r\n]+/gi,
  /\b[a-z][a-z0-9+.-]*:\/\/[^\s/:]+:[^\s/@]+@/gi
];
function compileCustom(pattern) {
  if (!pattern || pattern.length > 160 || !/^[A-Za-z0-9_:@/-]*(?:\[[A-Za-z0-9_-]+\]\{\d{1,3}(?:,\d{1,3})?\})?[A-Za-z0-9_:@/-]*$/.test(
    pattern
  )) {
    throw new Error(
      "Unsafe custom redaction expression; use literals, character classes and bounded {n,m}"
    );
  }
  const bounds = /\{(\d+)(?:,(\d+))?\}/.exec(pattern);
  if (bounds && (Number(bounds[1]) < 1 || Number(bounds[2] ?? bounds[1]) > 256 || Number(bounds[1]) > Number(bounds[2] ?? bounds[1])))
    throw new Error("Unsafe redaction bounds");
  return new RegExp(pattern, "g");
}
function redactText(text, custom = []) {
  let out = text;
  for (const regex of [...PATTERNS, ...custom])
    out = out.replace(regex, "[REDACTED]");
  return out;
}
function redact(value, custom = [], depth = 0) {
  if (depth > 16) return "[DEPTH LIMIT]";
  if (typeof value === "string") return redactText(value, custom);
  if (value === null || typeof value === "boolean" || typeof value === "number")
    return value;
  if (Array.isArray(value))
    return value.slice(0, 1e3).map((v) => redact(v, custom, depth + 1));
  const result = {};
  for (const [key, v] of Object.entries(object(value)).slice(0, 1e3)) {
    if (INTERNAL.test(key)) continue;
    result[redactText(key, custom)] = KEY.test(key) ? "[REDACTED]" : redact(v, custom, depth + 1);
  }
  return result;
}
function canonical(value, depth = 0) {
  if (depth > 24) throw new Error("Hook input nesting exceeds limit");
  if (Array.isArray(value))
    return "[" + value.map((v) => canonical(v, depth + 1)).join(",") + "]";
  if (value !== null && typeof value === "object") {
    return "{" + Object.keys(value).filter((k) => !INTERNAL.test(k)).sort().map(
      (k) => JSON.stringify(k) + ":" + canonical(object(value)[k], depth + 1)
    ).join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}
function digest(key, value) {
  return createHmac("sha256", key).update(canonical(value)).digest("hex");
}
function identity(key, value) {
  return digest(key, value).slice(0, 32);
}

// src/store.ts
import {
  appendFileSync,
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join, parse, resolve as resolve2 } from "node:path";
import { homedir } from "node:os";
var MAX_INPUT = 1024 * 1024;
var MAX_TRACE = 64 * 1024 * 1024;
var StoreError = class extends Error {
};
function dataRoot(pluginData) {
  return resolve2(
    process.env.AGENT_EVALS_DATA_DIR || pluginData || process.env.CLAUDE_PLUGIN_DATA || join(homedir(), ".claude", "plugins", "data", "agent-evals-local")
  );
}
function safePath(path) {
  const absolute = resolve2(path);
  let cursor = parse(absolute).root;
  for (const part of absolute.slice(cursor.length).split(/[\\/]/).filter(Boolean)) {
    cursor = join(cursor, part);
    try {
      if (lstatSync(cursor).isSymbolicLink())
        throw new StoreError("Symlink/reparse path refused");
    } catch (error) {
      if (object(error).code !== "ENOENT") throw error;
    }
  }
}
function ensureRoot(root) {
  safePath(root);
  mkdirSync(root, { recursive: true, mode: 448 });
  safePath(root);
}
function storeKey(root) {
  ensureRoot(root);
  const path = join(root, "hash-key");
  safePath(path);
  if (!existsSync(path)) {
    const temp = join(root, ".key-" + randomBytes(8).toString("hex"));
    writeFileSync(temp, randomBytes(32), { flag: "wx", mode: 384 });
    try {
      linkSync(temp, path);
    } catch (error) {
      if (object(error).code !== "EEXIST") throw error;
    } finally {
      unlinkSync(temp);
    }
  }
  const key = readFileSync(path);
  if (key.length !== 32) throw new StoreError("Invalid store hash key");
  return key;
}
function sessionPath(root, id) {
  if (!/^[a-f0-9]{32}$/.test(id))
    throw new StoreError("Invalid session identifier");
  const path = join(root, "sessions", id + ".jsonl");
  safePath(path);
  return path;
}
function tailSeq(path) {
  if (!existsSync(path)) return 0;
  const size = statSync(path).size;
  if (!size) return 0;
  if (size > MAX_TRACE) throw new StoreError("Trace exceeds 64 MiB limit");
  const fd = openSync(path, "r");
  try {
    let bytes = Math.min(size, 8192);
    let line = "";
    while (true) {
      const buffer = Buffer.alloc(bytes);
      readSync(fd, buffer, 0, bytes, size - bytes);
      const text = buffer.toString("utf8");
      if (!text.endsWith("\n"))
        throw new StoreError("Truncated trace tail; run recover explicitly");
      const previous = text.lastIndexOf("\n", text.length - 2);
      if (previous >= 0 || bytes === size) {
        line = text.slice(previous + 1, -1);
        break;
      }
      if (bytes >= MAX_INPUT + 8192)
        throw new StoreError("Trace record exceeds bound");
      bytes = Math.min(size, bytes * 2, MAX_INPUT + 8192);
    }
    let last;
    try {
      last = JSON.parse(line);
    } catch {
      throw new StoreError("Corrupt trace tail");
    }
    const seq = object(last).seq;
    if (!Number.isSafeInteger(seq) || Number(seq) < 1)
      throw new StoreError("Invalid trace sequence");
    return Number(seq);
  } finally {
    closeSync(fd);
  }
}
async function locked(path, operation, waitMs = 400) {
  const start = Date.now();
  const lock = path + ".lock";
  safePath(lock);
  let acquired = false;
  let lockFd;
  while (!acquired) {
    try {
      lockFd = openSync(lock, "wx", 384);
      acquired = true;
    } catch (error) {
      if (object(error).code !== "EEXIST") throw error;
      if (Date.now() - start > waitMs)
        throw new StoreError(
          "Recorder busy or stale lock; inspect lock, do not delete while recording"
        );
      await new Promise((r) => setTimeout(r, 5));
    }
  }
  try {
    return operation();
  } finally {
    if (lockFd !== void 0) closeSync(lockFd);
    unlinkSync(lock);
  }
}
async function appendEvent(root, event) {
  ensureRoot(root);
  const path = sessionPath(root, event.session_id);
  mkdirSync(dirname(path), { recursive: true, mode: 448 });
  return locked(path, () => {
    safePath(path);
    event.seq = tailSeq(path) + 1;
    const line = JSON.stringify(event) + "\n";
    if (Buffer.byteLength(line) > MAX_INPUT)
      throw new StoreError("Normalized event too large");
    const fd = openSync(path, "a", 384);
    try {
      appendFileSync(fd, line, "utf8");
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    return event;
  });
}
function validateEvents(events) {
  if (!events.length) throw new StoreError("Empty trace");
  let session;
  let workspace;
  for (let i = 0; i < events.length; i++) {
    const e = object(events[i]);
    const metadata = object(e.metadata);
    const numberFields = [
      "input_bytes",
      "output_bytes",
      "exit_code",
      "background_count"
    ];
    const hashFields = [
      "input_hash",
      "output_hash",
      "error_hash",
      "old_hash",
      "new_hash"
    ];
    const booleanFields = [
      "capture_content",
      "completion_marker_seen",
      "suppressed_content"
    ];
    const stringFields = [
      "error_category",
      "verification",
      "file_id",
      "file_kind",
      "source",
      "stop_reason",
      "compaction_trigger",
      "verification_scope",
      "verification_outcome"
    ];
    const allowedFields = [
      ...numberFields,
      ...hashFields,
      ...booleanFields,
      ...stringFields
    ];
    if (Object.keys(metadata).some((k) => !allowedFields.includes(k)) || numberFields.some(
      (k) => metadata[k] !== void 0 && (!Number.isSafeInteger(metadata[k]) || k !== "exit_code" && Number(metadata[k]) < 0)
    ) || hashFields.some(
      (k) => metadata[k] !== void 0 && (typeof metadata[k] !== "string" || !/^[a-f0-9]{64}$/.test(String(metadata[k])))
    ) || booleanFields.some(
      (k) => metadata[k] !== void 0 && typeof metadata[k] !== "boolean"
    ) || stringFields.some(
      (k) => metadata[k] !== void 0 && (typeof metadata[k] !== "string" || String(metadata[k]).length > 80)
    ) || e.duration_ms !== void 0 && (typeof e.duration_ms !== "number" || !Number.isFinite(e.duration_ms) || e.duration_ms < 0) || e.outcome !== void 0 && !["success", "failure", "cancelled", "denied", "unknown"].includes(
      String(e.outcome)
    ) || ![
      "session",
      "prompt",
      "tool_call",
      "tool_result",
      "stop",
      "subagent",
      "compaction"
    ].includes(String(e.event_type)) || ["correlation_id", "agent_id", "prompt_id"].some(
      (k) => e[k] !== void 0 && (typeof e[k] !== "string" || !/^[a-f0-9]{32}$/.test(String(e[k])))
    ) || metadata.verification !== void 0 && !["test", "lint", "build"].includes(String(metadata.verification)) || metadata.file_kind !== void 0 && !["source", "test", "other"].includes(String(metadata.file_kind)))
      throw new StoreError("Invalid event fields at line " + (i + 1));
    if (e.seq !== i + 1 || e.schema_version !== SCHEMA_VERSION || e.source !== "claude-code" || !HOOKS.includes(e.source_hook) || typeof e.timestamp !== "string" || !Number.isFinite(Date.parse(e.timestamp)) || typeof e.session_id !== "string" || !/^[a-f0-9]{32}$/.test(e.session_id) || typeof e.workspace_id !== "string" || !/^[a-f0-9]{32}$/.test(e.workspace_id) || typeof object(e.metadata).capture_content !== "boolean")
      throw new StoreError("Corrupt or unsupported event at line " + (i + 1));
    if (i === 0) {
      session = e.session_id;
      workspace = e.workspace_id;
    }
    if (e.session_id !== session || e.workspace_id !== workspace)
      throw new StoreError("Mixed session/workspace identities");
    if (e.content !== void 0 && !object(e.metadata).capture_content)
      throw new StoreError("Unexpected content in metadata-only event");
  }
  return events;
}
function readEvents(root, id) {
  const path = sessionPath(root, id);
  if (!existsSync(path)) throw new StoreError("Session not found");
  if (statSync(path).size > MAX_TRACE)
    throw new StoreError("Trace exceeds size limit");
  const text = readFileSync(path, "utf8");
  if (!text.endsWith("\n"))
    throw new StoreError(
      "Truncated JSONL; report refused. Use recover for tail recovery."
    );
  try {
    return validateEvents(
      text.slice(0, -1).split("\n").map((line) => JSON.parse(line))
    );
  } catch (error) {
    if (error instanceof StoreError) throw error;
    throw new StoreError("Invalid JSONL; report refused");
  }
}
function latestSession(root, workspaceId) {
  const folder = join(root, "sessions");
  safePath(folder);
  if (!existsSync(folder)) throw new StoreError("No recorded sessions");
  const candidates = readdirSync(folder).filter((n) => /^[a-f0-9]{32}\.jsonl$/.test(n)).map((n) => ({
    id: n.slice(0, -6),
    mtime: statSync(sessionPath(root, n.slice(0, -6))).mtimeMs
  })).sort((a, b) => b.mtime - a.mtime);
  for (const c of candidates) {
    const events = readEvents(root, c.id);
    if (!workspaceId || (Array.isArray(workspaceId) ? workspaceId : [workspaceId]).includes(
      events[0].workspace_id
    ))
      return c.id;
  }
  throw new StoreError("No recorded sessions for this workspace");
}
function writeArtifact(root, id, name, content) {
  if (!/^[a-z][a-z0-9.-]+$/.test(name))
    throw new StoreError("Invalid artifact name");
  sessionPath(root, id);
  const folder = join(root, "reports", id);
  safePath(folder);
  mkdirSync(folder, { recursive: true, mode: 448 });
  const dest = join(folder, name);
  safePath(dest);
  const temp = join(folder, "." + randomBytes(8).toString("hex") + ".tmp");
  writeFileSync(temp, content, { mode: 384, flag: "wx" });
  renameSync(temp, dest);
  return dest;
}
async function recoverTail(root, id) {
  const path = sessionPath(root, id);
  return locked(path, () => {
    safePath(path);
    if (statSync(path).size > MAX_TRACE)
      throw new StoreError("Trace exceeds size limit");
    const text = readFileSync(path, "utf8");
    if (text.endsWith("\n")) {
      readEvents(root, id);
      return 0;
    }
    const boundary = text.lastIndexOf("\n") + 1;
    const prefix = text.slice(0, boundary);
    validateEvents(
      prefix.trimEnd().split("\n").map((line) => JSON.parse(line))
    );
    const tail = text.slice(boundary);
    writeArtifact(root, id, "quarantined-tail.txt", tail);
    writeFileSync(path, prefix, { mode: 384 });
    return Buffer.byteLength(tail);
  });
}

// src/config.ts
var DEFAULT_CONFIG = {
  captureContent: false,
  customRedactions: [],
  windowMs: 12e4,
  repeatedCalls: 3,
  failureLoop: 3,
  excessiveRetries: 6,
  longToolMs: 12e4,
  oscillations: 4,
  completionMarker: null
};
function parseConfig(value) {
  const raw = object(value);
  const known = Object.keys(DEFAULT_CONFIG);
  if (Object.keys(raw).some((k) => !known.includes(k)))
    throw new Error("Unknown configuration key");
  const config = { ...DEFAULT_CONFIG, ...raw };
  if (typeof config.captureContent !== "boolean")
    throw new Error("captureContent must be boolean");
  for (const name of [
    "windowMs",
    "repeatedCalls",
    "failureLoop",
    "excessiveRetries",
    "longToolMs",
    "oscillations"
  ]) {
    if (!Number.isSafeInteger(config[name]) || config[name] < 1 || config[name] > 864e5)
      throw new Error("Invalid detector threshold");
  }
  if (!Array.isArray(config.customRedactions) || config.customRedactions.length > 20 || config.customRedactions.some((p) => typeof p !== "string"))
    throw new Error("Invalid customRedactions");
  config.customRedactions.forEach(compileCustom);
  if (config.completionMarker !== null && (typeof config.completionMarker !== "string" || !/^[A-Z_]{8,80}$/.test(config.completionMarker)))
    throw new Error("Invalid completionMarker");
  return config;
}
function loadConfig(root) {
  const path = join2(root, "config.json");
  if (!existsSync2(path)) return { ...DEFAULT_CONFIG };
  safePath(path);
  return parseConfig(JSON.parse(readFileSync2(path, "utf8")));
}

// src/normalize.ts
var import_shell_quote = __toESM(require_shell_quote(), 1);
function verificationKind(command) {
  if (/[;&|`\n\r<>]/.test(command) || command.includes("$(")) return;
  const text = command.trim();
  if (/^(?:npm|pnpm|yarn|bun) (?:test|run (?:test(?::[\w-]+)?|test:unit))(?:\s|$)/.test(
    text
  ) || /^(?:node --test|pytest|python(?:3)? -m (?:pytest|unittest)|cargo test|go test|dotnet test)(?:\s|$)/.test(
    text
  ))
    return "test";
  if (/^(?:(?:npm|pnpm|yarn|bun) run lint|eslint|ruff check|cargo clippy)(?:\s|$)/.test(
    text
  ))
    return "lint";
  if (/^(?:(?:npm|pnpm|yarn|bun) run build|tsc|cargo build|go build|dotnet build)(?:\s|$)/.test(
    text
  ))
    return "build";
}
function verificationSignal(command) {
  if (command.length > 8192 || /[`\n\r]/.test(command) || command.includes("$"))
    return;
  const cleaned = command.replace(/\s+2>&1(?=\s*(?:\||$))/g, "");
  let tokens;
  try {
    tokens = (0, import_shell_quote.parse)(cleaned, () => "");
  } catch {
    return;
  }
  let scope = "direct";
  if (tokens[0] === "cd" && typeof tokens[1] === "string" && object(tokens[2]).op === "&&") {
    tokens = tokens.slice(3);
    scope = "cd_prefix";
  }
  const pipe = tokens.findIndex((t) => object(t).op === "|");
  if (pipe >= 0) {
    const tail = tokens.slice(pipe + 1);
    if (!["head", "tail", "cat"].includes(String(tail[0])) || tail.some((t) => typeof t !== "string"))
      return;
    tokens = tokens.slice(0, pipe);
    scope = "output_pipeline";
  }
  if (!tokens.length || tokens.some((t) => typeof t !== "string")) return;
  const first = tokens[0];
  if (typeof first !== "string" || /\s/.test(first)) return;
  if (first === "node" && tokens[1] !== "--test") return;
  if (["npm", "pnpm", "yarn", "bun"].includes(first) && !(tokens[1] === "test" || tokens[1] === "run" && typeof tokens[2] === "string" && !/\s/.test(tokens[2])))
    return;
  if (["python", "python3"].includes(first) && tokens[1] !== "-m") return;
  if (["cargo", "go", "dotnet", "ruff"].includes(first) && typeof tokens[1] === "string" && /\s/.test(tokens[1]))
    return;
  const kind = verificationKind(tokens.join(" "));
  return kind ? { kind, scope } : void 0;
}
function fileKind(path) {
  if (/(?:^|[\\/])(?:tests?|__tests__)(?:[\\/]|$)|(?:\.|_)(?:test|spec)\.[\w]+$/i.test(
    path
  ))
    return "test";
  return /\.(?:[cm]?[jt]sx?|py|rs|go|java|kt|c|cpp|h|cs|rb|php|sh|gd|jl|r|m)$/i.test(
    path
  ) ? "source" : "other";
}
function errorCategory(error, interrupted) {
  if (interrupted) return "cancelled";
  if (/^Exit code -?\d+\b/.test(error)) return "nonzero_exit";
  if (/timed out|timeout/i.test(error)) return "timeout";
  if (/permission|denied|not allowed/i.test(error))
    return "permission_related_unconfirmed";
  return "tool_error";
}
function normalize(rawValue, key, config, now = Date.now(), projectDir) {
  const raw = object(rawValue);
  if (typeof raw.session_id !== "string" || !raw.session_id || raw.session_id.length > 512 || typeof raw.cwd !== "string" || !raw.cwd || raw.cwd.length > 8192 || !HOOKS.includes(raw.hook_event_name))
    throw new Error("Invalid/unsupported hook input");
  const hook = raw.hook_event_name;
  const custom = config.customRedactions.map(compileCustom);
  const input2 = object(raw.tool_input);
  const response = object(raw.tool_response);
  const inputText = canonical(raw.tool_input ?? raw.prompt ?? null);
  const outputText = canonical(
    raw.tool_response ?? raw.error ?? raw.last_assistant_message ?? null
  );
  const event = {
    schema_version: SCHEMA_VERSION,
    seq: 0,
    timestamp: new Date(now).toISOString(),
    session_id: identity(key, raw.session_id),
    workspace_id: workspaceIdentity(key, projectDir ?? raw.cwd),
    source: "claude-code",
    source_hook: hook,
    event_type: hook === "UserPromptSubmit" ? "prompt" : hook === "PreToolUse" ? "tool_call" : ["PostToolUse", "PostToolUseFailure", "PermissionDenied"].includes(
      hook
    ) ? "tool_result" : ["Stop", "StopFailure"].includes(hook) ? "stop" : hook === "PreCompact" ? "compaction" : hook.startsWith("Subagent") ? "subagent" : "session",
    metadata: {
      capture_content: config.captureContent,
      input_bytes: Buffer.byteLength(inputText),
      output_bytes: Buffer.byteLength(outputText)
    }
  };
  if (typeof raw.agent_id === "string")
    event.agent_id = identity(key, raw.agent_id);
  if (typeof raw.prompt_id === "string")
    event.prompt_id = identity(key, raw.prompt_id);
  if (typeof raw.tool_name === "string") {
    if (!/^[\w:.-]{1,160}$/.test(raw.tool_name))
      throw new Error("Invalid tool name");
    event.tool_name = redactText(raw.tool_name, custom);
    const args = { ...input2 };
    delete args.description;
    event.metadata.input_hash = digest(key, args);
  }
  if (typeof raw.tool_use_id === "string")
    event.correlation_id = identity(key, raw.tool_use_id);
  if (raw.tool_response !== void 0)
    event.metadata.output_hash = digest(key, raw.tool_response);
  if (hook === "PostToolUse")
    event.outcome = response.interrupted === true ? "cancelled" : "success";
  if (hook === "PostToolUseFailure") {
    const interrupted = raw.is_interrupt === true;
    event.outcome = interrupted ? "cancelled" : "failure";
    const error = typeof raw.error === "string" ? raw.error : "";
    event.metadata.error_hash = digest(key, error);
    event.metadata.error_category = errorCategory(error, interrupted);
    const exit = /^(?:Exit code )(-?\d+)\b/.exec(error);
    if (exit) event.metadata.exit_code = Number(exit[1]);
  }
  if (hook === "PermissionDenied") {
    event.outcome = "denied";
    event.metadata.error_category = "auto_mode_denial";
  }
  if (hook === "StopFailure") {
    event.outcome = "failure";
    event.metadata.error_category = "api_error";
  }
  if (typeof raw.duration_ms === "number" && Number.isFinite(raw.duration_ms) && raw.duration_ms >= 0)
    event.duration_ms = raw.duration_ms;
  if (event.tool_name === "Bash" || event.tool_name === "PowerShell") {
    if (typeof input2.command === "string" && input2.run_in_background !== true) {
      const signal = verificationSignal(input2.command);
      if (signal) {
        event.metadata.verification = signal.kind;
        event.metadata.verification_scope = signal.scope;
        event.metadata.verification_outcome = signal.scope === "output_pipeline" || signal.scope === "cd_prefix" && event.outcome !== "success" ? "unknown" : event.outcome ?? "unknown";
      }
    }
  }
  if (typeof input2.file_path === "string" || typeof input2.notebook_path === "string") {
    const path = String(input2.file_path ?? input2.notebook_path);
    event.metadata.file_id = identity(key, path);
    event.metadata.file_kind = fileKind(path);
  }
  if (event.tool_name === "Edit" && typeof input2.old_string === "string" && typeof input2.new_string === "string") {
    event.metadata.old_hash = digest(key, input2.old_string);
    event.metadata.new_hash = digest(key, input2.new_string);
  }
  if (typeof raw.source === "string" && ["startup", "resume", "clear", "compact", "fork"].includes(raw.source))
    event.metadata.source = raw.source;
  if (hook === "SessionEnd" && typeof raw.reason === "string") {
    event.metadata.stop_reason = [
      "clear",
      "logout",
      "prompt_input_exit",
      "bypass_permissions_disabled",
      "other"
    ].includes(raw.reason) ? raw.reason : "unrecognized";
  }
  if (hook === "Stop") {
    event.metadata.background_count = Array.isArray(raw.background_tasks) ? raw.background_tasks.length : 0;
    event.metadata.completion_marker_seen = config.completionMarker !== null && typeof raw.last_assistant_message === "string" && raw.last_assistant_message.trim().split(/\r?\n/).at(-1) === config.completionMarker;
  }
  if (hook === "PreCompact")
    event.metadata.compaction_trigger = raw.trigger === "manual" ? "manual" : raw.trigger === "auto" ? "auto" : "unknown";
  if (config.captureContent) {
    const file = String(
      input2.file_path ?? input2.notebook_path ?? input2.command ?? ""
    );
    if (/(?:^|[\\/\s'"=])(?:\.env(?:\.[^\\/\s'";]*)?|credentials(?:\.json)?|id_rsa|id_ed25519|[^\\/\s]*\.pem)(?:$|[\\/\s'";])/i.test(
      file
    )) {
      event.metadata.suppressed_content = true;
    } else {
      const content = {};
      for (const field of [
        "tool_input",
        "tool_response",
        "prompt",
        "error",
        "last_assistant_message"
      ]) {
        if (raw[field] !== void 0)
          content[field] = redact(raw[field], custom);
      }
      event.content = content;
    }
  }
  return event;
}

// src/report.ts
function escapeHtml(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]
  );
}
function markdown(trace) {
  const rows = Object.entries(trace.metrics).map(
    ([name, value]) => "| " + name + " | " + (value ?? "unavailable") + " |"
  ).join("\n");
  const findings = trace.findings.map(
    (f) => `- **${f.id} (${f.severity})**: ${f.message} Events: ${f.event_seqs.join(", ")}.`
  ).join("\n") || "No configured rule fired. This does not establish task success.";
  return `# Claude Code Reliability Report

Session: \`${trace.session.id}\`

Evidence scope: observed public hooks. Final task outcome: **unknown**.

## Overview

| Metric | Value |
|---|---:|
${rows}

## Findings

${findings}

## Verification

${trace.verification.map((v) => `- Event ${v.event_seq}: ${v.kind} / ${v.outcome}`).join("\n") || "No recognized foreground verification observed."}

## Limitations

${trace.limitations.map((v) => "- " + v).join("\n")}
`;
}
function html(trace) {
  const esc = escapeHtml;
  const table = (headers, rows) => `<table><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((v) => `<td>${esc(v ?? "unavailable")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src 'none'; base-uri 'none'; form-action 'none'"><title>Agent Evals \u2014 Reliability Evidence</title><style>
  :root{color-scheme:dark}*{box-sizing:border-box}body{font:15px/1.6 system-ui,sans-serif;background:#101821;color:#dce6ef;max-width:1180px;margin:0 auto;padding:36px}h1{font-size:34px;letter-spacing:-1px}h2{color:#7dd5c0;margin-top:38px}p{max-width:85ch}.badge{border:1px solid #456575;padding:5px 12px;border-radius:4px;color:#98dbca}table{width:100%;border-collapse:collapse;margin:14px 0;font-variant-numeric:tabular-nums}th{text-align:left;color:#8eaac0}td,th{padding:9px;border-bottom:1px solid #293a48;overflow-wrap:anywhere}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#152330;padding:16px;border-radius:6px}.finding{border-left:3px solid #eabf74;background:#182735;padding:16px;margin:12px 0}.muted{color:#99acbb}code{font-size:13px}footer{margin-top:40px;border-top:1px solid #293a48;padding-top:20px}</style></head><body>
  <span class="badge">COMMUNITY PLUGIN \xB7 LOCAL EVIDENCE</span><h1>Claude Code Reliability Report</h1><p class="muted">Session ${esc(trace.session.id)} \xB7 ${esc(trace.session.first_observed)} \u2192 ${esc(trace.session.last_observed)}</p><p>Final task outcome: <strong>unknown</strong>. Rules describe observed behavior; absence of findings is not proof of success.</p>
  <h2>Overview</h2>${table(["Metric", "Value"], Object.entries(trace.metrics))}
  <h2>Findings</h2>${trace.findings.map((f) => `<article class="finding"><strong>${esc(f.id)} \xB7 ${esc(f.severity)}</strong><p>${esc(f.message)}</p><p>Evidence events: ${esc(f.event_seqs.join(", "))}</p><pre>${esc(JSON.stringify(f.evidence, null, 2))}</pre></article>`).join("") || "<p>No configured rule fired.</p>"}
  <h2>Timeline</h2>${table(
    ["Seq", "Receipt time", "Hook", "Tool", "Outcome"],
    trace.events.map((e) => [
      e.seq,
      e.timestamp,
      e.source_hook,
      e.tool_name,
      e.outcome
    ])
  )}
  <h2>Tools</h2>${table(
    ["Call", "Result", "Tool", "Outcome", "Duration (ms)", "Duration source"],
    trace.tool_calls.map((c) => [
      c.call_seq,
      c.result_seq,
      c.tool_name,
      c.outcome,
      c.duration_ms,
      c.duration_source
    ])
  )}
  <h2>Verification</h2>${table(
    ["Event", "Kind", "Outcome"],
    trace.verification.map((v) => [v.event_seq, v.kind, v.outcome])
  )}
  <h2>Workspace diff metrics</h2><pre>${esc(JSON.stringify(trace.workspace_diff ?? { available: false, reason: "Use CLI report --git to take a current workspace snapshot. No agent attribution." }, null, 2))}</pre>
  <h2>Subagents and compaction</h2>${table(
    ["Event", "Hook", "Agent (hashed)"],
    trace.events.filter(
      (e) => e.event_type === "subagent" || e.event_type === "compaction"
    ).map((e) => [e.seq, e.source_hook, e.agent_id])
  )}
  <h2>Limitations</h2><ul>${trace.limitations.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><footer>No scripts, remote assets, uploads, or hidden reasoning. Schema ${esc(trace.schema_version)}. All findings are deterministic; LLM interpretation is optional and separate.</footer></body></html>`;
}
function evalCase(trace) {
  return {
    schema_version: trace.schema_version,
    kind: "observable_agent_eval_case",
    task: {
      session_id: trace.session.id,
      workspace_id: trace.session.workspace_id,
      description: "Not captured in metadata-only mode"
    },
    events: trace.events,
    findings: trace.findings,
    metrics: trace.metrics,
    verification: trace.verification,
    workspace_diff: trace.workspace_diff ?? null,
    final_outcome: {
      status: "unknown",
      reason: "Public hook boundaries do not prove task completion"
    },
    annotation: { human_labels: [], reviewed_by: null },
    limitations: trace.limitations
  };
}

// src/git.ts
import { spawnSync } from "node:child_process";
function workspaceDiff(cwd) {
  const run = (args) => spawnSync(
    "git",
    ["-c", "core.hooksPath=", "-c", "diff.external=", ...args],
    {
      cwd,
      encoding: "utf8",
      timeout: 5e3,
      maxBuffer: 1024 * 1024,
      env: { ...process.env, GIT_OPTIONAL_LOCKS: "0", GIT_EXTERNAL_DIFF: "" }
    }
  );
  const diff = run([
    "diff",
    "--no-ext-diff",
    "--no-textconv",
    "--numstat",
    "-z",
    "HEAD",
    "--"
  ]);
  if (diff.error || diff.status !== 0)
    return {
      available: false,
      reason: "Git HEAD diff unavailable or exceeded bound",
      attribution: "workspace snapshot only"
    };
  const records = diff.stdout.split("\0").filter(Boolean);
  let added = 0, deleted = 0, files = 0, tests = 0, source = 0, binary = 0;
  for (let i = 0; i < records.length; i++) {
    const match = /^(\d+|-)\t(\d+|-)\t(.*)$/s.exec(records[i]);
    if (!match) continue;
    files++;
    let file = match[3];
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
    attribution: "current workspace diff against HEAD; includes pre-existing and external changes",
    observed_at: (/* @__PURE__ */ new Date()).toISOString(),
    files_touched: files,
    lines_added: added,
    lines_deleted: deleted,
    test_files_changed: tests,
    source_files_changed: source,
    binary_files: binary,
    untracked_file_count: untracked.status === 0 ? untracked.stdout.split("\0").filter(Boolean).length : null,
    untracked_lines_included: false
  };
}

// src/cli.ts
async function input() {
  let size = 0;
  const parts = [];
  for await (const chunk of process.stdin) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_INPUT)
      throw new StoreError("Hook input exceeds 1 MiB; event skipped");
    parts.push(buffer);
  }
  return Buffer.concat(parts).toString("utf8");
}
async function main(args = process.argv.slice(2)) {
  const command = args.shift() ?? "help";
  const pluginDataIndex = args.indexOf("--plugin-data");
  let pluginData;
  if (pluginDataIndex >= 0) {
    pluginData = args[pluginDataIndex + 1];
    if (!pluginData || pluginData.startsWith("--"))
      throw new StoreError("--plugin-data requires a directory");
    args.splice(pluginDataIndex, 2);
  }
  const root = dataRoot(pluginData);
  if (command === "hook") {
    try {
      const now = Date.now();
      const text = await input();
      const raw = JSON.parse(text);
      const config2 = loadConfig(root);
      const event = normalize(
        raw,
        storeKey(root),
        config2,
        now,
        process.env.CLAUDE_PROJECT_DIR
      );
      await appendEvent(root, event);
    } catch {
      process.stderr.write(
        "agent-evals: event skipped (invalid input, configuration, storage, or contention). Run doctor; coding task continues.\n"
      );
    }
    return;
  }
  const allowed = /* @__PURE__ */ new Set([
    "help",
    "doctor",
    "config-init",
    "status",
    "report",
    "export",
    "make-case",
    "recover"
  ]);
  if (!allowed.has(command)) throw new StoreError("Unknown command");
  let session;
  let rawSession;
  let git = false;
  let jsonl = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--session") session = args[++i];
    else if (arg === "--raw-session") rawSession = args[++i];
    else if (arg === "--git") git = true;
    else if (arg === "--jsonl") jsonl = true;
    else throw new StoreError("Unsupported argument; run help");
  }
  if (command === "help") {
    console.log(
      "agent-evals: hook | doctor | config-init | status | report | export [--jsonl] | make-case | recover\nSelect --session <hashed-id> or --raw-session <Claude session id>; default latest in current workspace.\nreport/make-case --git: explicit read-only workspace snapshot. AGENT_EVALS_DATA_DIR overrides the data directory."
    );
    return;
  }
  ensureRoot(root);
  if (command === "config-init") {
    const path = join3(root, "config.json");
    safePath(path);
    if (existsSync3(path))
      throw new StoreError("Config already exists; edit it explicitly");
    writeFileSync2(path, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", {
      flag: "wx",
      mode: 384
    });
    console.log(path);
    return;
  }
  const key = storeKey(root);
  const config = loadConfig(root);
  if (command === "doctor") {
    console.log(
      JSON.stringify(
        {
          node: process.version,
          data_directory: root,
          capture_content: config.captureContent,
          hook_input_limit_bytes: MAX_INPUT,
          storage: "local only",
          scope: "doctor checks configuration, not hook delivery or credentials",
          note: "An interrupted process can leave .lock; inspect before removing manually."
        },
        null,
        2
      )
    );
    return;
  }
  const id = rawSession ? identity(key, rawSession) : session ?? latestSession(root, workspaceCandidates(key, process.cwd()));
  if (command === "recover") {
    console.log(
      JSON.stringify({
        recovered_tail_bytes: await recoverTail(root, id),
        session_id: id
      })
    );
    return;
  }
  const events = readEvents(root, id);
  const trace = analyze(events, parseConfig(config));
  if (git) {
    if (!workspaceCandidates(key, process.cwd()).includes(events[0].workspace_id))
      throw new StoreError("Git snapshot requires the recorded workspace");
    trace.workspace_diff = workspaceDiff(process.cwd());
  }
  if (command === "status") {
    console.log(
      JSON.stringify(
        {
          session: trace.session,
          metrics: trace.metrics,
          findings: trace.findings.length,
          capture_content: config.captureContent,
          limitations: trace.limitations
        },
        null,
        2
      )
    );
    return;
  }
  if (command === "report") {
    const paths = [
      writeArtifact(root, id, "report.html", html(trace)),
      writeArtifact(root, id, "report.md", markdown(trace)),
      writeArtifact(
        root,
        id,
        "trace.json",
        JSON.stringify(trace, null, 2) + "\n"
      )
    ];
    console.log(
      JSON.stringify(
        { paths, findings: trace.findings, metrics: trace.metrics },
        null,
        2
      )
    );
    return;
  }
  if (command === "export") {
    const filename = jsonl ? "events.jsonl" : "trace.json";
    const text = jsonl ? events.map((e) => JSON.stringify(e)).join("\n") + "\n" : JSON.stringify(trace, null, 2) + "\n";
    console.log(writeArtifact(root, id, filename, text));
    return;
  }
  if (command === "make-case")
    console.log(
      writeArtifact(
        root,
        id,
        "eval-case.json",
        JSON.stringify(evalCase(trace), null, 2) + "\n"
      )
    );
}
if (process.env.AGENT_EVALS_LIBRARY !== "1") {
  main().catch((error) => {
    console.error(
      error instanceof StoreError ? error.message : "agent-evals: operation failed; check configuration and trace integrity"
    );
    if (object(error).code === "ENOENT")
      console.error(
        "Missing local data; run a Claude Code session with the plugin first."
      );
    process.exitCode = 1;
  });
}
export {
  main
};
