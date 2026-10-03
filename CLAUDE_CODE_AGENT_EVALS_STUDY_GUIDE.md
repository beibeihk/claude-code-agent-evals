# Claude Code Agent Evals 学习与面试指南

这份指南对应可运行代码与公开接口。区分 Claude Code（客户端/harness）和背后的模型服务；
当前真实任务使用用户授权的 Kimi Coding，不应写成 Anthropic 模型性能评估。

## 必须掌握的工程路径

Plugin 是打包/安装单位；skill 是可复用指令与用户命令；agent 是带工具约束的独立角色；
hook 是生命周期回调；MCP 是工具服务协议；settings 决定安装范围、权限和加载行为。
公开 hooks 提供有限输入，不能视为完整运行历史或目标正确性证明。

阅读 `hooks/hooks.json` → `src/cli.ts` → `src/normalize.ts` → `src/store.ts` →
`src/analyze.ts` → `src/report.ts`。先理解 recorder 不输出决策，再理解 per-session lock
如何保证序号，最后追踪 finding 的 `event_seqs` 如何回到原始证据。

`CLAUDE_PLUGIN_ROOT` 用于安装路径，`CLAUDE_PLUGIN_DATA` 用于跨更新持久化。
Bash 工具不自动继承 plugin 路径变量，skill 内容需使用官方占位符展开后的字面路径。
默认只保存元数据；内容模式须显式配置且先脱敏。哈希是 per-store HMAC，导出不带密钥。

Claude Code Action 的主路径是 GitHub event → context/trigger 与 mode → 权限和认证 →
工作分支/提示准备 → SDK 执行 → 进度/结果评论与清理。API、OAuth、Bedrock、Vertex、
Foundry 的认证与环境不同，不能把某个 provider 的失败当作模型失败。
事件载荷、token scope、fork 与工作流来源是可重复测试的工程边界。

## 30 道面试题与参考答案

1. **Hook 和 MCP 有什么区别？** Hook 接收官方生命周期输入；MCP 向模型暴露可调用工具。观察应优先依赖回调，不能期待模型总会主动调用“日志工具”。
2. **为什么 observability 用 hooks？** 回调由 harness 触发，能关联调用前后；MCP 日志工具的调用选择本身受 agent 策略影响，会产生选择性遗漏。
3. **Stop 能看到什么？** 当前公开输入提供最终公开 assistant 文本、停止 hook 状态及部分后台任务信息；它是轮次边界，不能证明用户目标完成。
4. **为什么不获取 hidden reasoning？** 私有推理既不属于公开插件契约，也不是可审计的行为证据。工程对象是公开操作与结果。
5. **PreToolUse 能做什么？** 可在执行前做公开协议支持的决策/输入调整/上下文注入；本观察器不使用这些控制字段，只记录允许的元数据。
6. **怎样保证插件不改变 agent 行为？** 不返回权限、更新输入、阻止 Stop 或注入上下文，不自动调用分析代理。仍有时间/上下文成本，必须实测，不能声称零影响。
7. **怎样避免拖慢 agent？** 无网络、模型与 git 扫描；有界输入/锁等待；单条本地写。Node 启动成本也计入 benchmark。异步虽快，但退出可能取消记录。
8. **Compaction 对 trace 意味着什么？** 公开边界和时间相关信息；不能从之后失败反推出压缩造成 context loss。需要对照实验检验机制。
9. **什么是 agent eval？** 在规定任务、工具与环境下，以独立结果标准评价过程/结果。Trace detector 只是证据提取，不是完整任务评分器。
10. **Repeated tool 一定失败吗？** 不一定。轮询、读取变化文件或教学任务可合法重复，所以 F01 默认 info，保留阈值和原始序号。
11. **Precision 和 recall 如何权衡？** 面向告警先控制误报成本；先建立可判定证据和独立标签。只有正例全集可确定时才能估计 recall。
12. **为何先 deterministic rules？** 定义、边界与失败可复现，便于回归。LLM 可提出解释，但判断波动、prompt 和 provider 都是额外测量误差。
13. **怎样建立 ground truth？** 预先规定标注单位与失败定义，提供事件证据/独立测试，真实人工标注并保留歧义；双人复核分歧。自动预期标签不能称人工 ground truth。
14. **如何检测 goal drift？** 需要任务目标与行为语义的独立对照，元数据不足。未来可显式 opt-in 任务目标，再用有标注的 judge，保持与证据层分离。
15. **哪些失败无法由 trace 判断？** 业务逻辑错误、测试覆盖不足、需求误解、目标漂移、外部不可见状态、用户满意度和 causal context loss。
16. **如何区分 model 与 tool failure？** 先报告失败来源、环境和结果；工具退出非零可能来自 agent 参数、外部依赖或预期红测。仅凭 hook 不作因果归责。
17. **GitHub Action 如何安全用 token？** 最小权限、官方 secret/context 传递、避免输出/持久化、不向 fork 的不可信代码暴露凭据、清理 checkout 认证配置。
18. **Fork PR 的权限风险？** 事件可来自不可信作者；`pull_request_target`/workflow 来源与 checkout 的代码来源可能不同。要独立验证作者权限、配置来源与执行路径。
19. **为何 event payload 重要？** issue comment、review comment、push、dispatch 的字段和语义不同。错误推断会关联错 PR、选错 mode 或跳过权限。
20. **Structured output 怎么验证？** 验证任务执行结果/错误后，再检查结构是否符合声明 schema；缺失、null、错误 subtype 与 schema 不匹配应保留明确失败来源。
21. **Mode detection 怎么测试？** 用真实类型的 payload fixtures 覆盖触发词位置、大小写、不同事件、空/畸形字段及非触发反例。测试契约而非镜像实现。
22. **如何 mock GitHub context？** 注入 eventName、payload、repo、actor 和 run 元数据；mock REST/GraphQL 调用及分页/权限。避免用真实 token 做单元测试。
23. **如何保证写入原子性？** exclusive-create per-session lock 保证单 writer 和 seq；一条 append 后 fsync。崩溃仍可留下 partial tail，不能把 append 说成事务。
24. **Parallel tools 如何 correlate？** 使用公开 tool_use_id 加 agent_id，不能 FIFO 或仅靠相同参数。缺失 ID 则不猜测；乱序结果不能制造负耗时。
25. **HTML 如何防 XSS？** 所有值统一 escaping，不插入未经转义 JSON 或 tool input；无脚本/远程资源且使用 restrictive CSP。CSP 不替代 escaping。
26. **Secret redaction 怎么测？** 多种 fake tokens、嵌套键、headers、私钥和敏感路径，断言 secret 不存在于 trace、report、eval export；默认模式也要检验无正文。
27. **Crash 时 JSONL 如何恢复？** 正常读取拒绝 truncated tail；显式 recover 先验证前缀、隔离残片后截断；内部坏行不能悄悄跳过；stale lock 不自动抢占。
28. **Schema 版本怎么设计？** 明确 major/minor、字段语义和缺失值；major 更改需迁移。source、duration provenance 与 observation scope 与数据一同导出。
29. **如何接其他 agents？** 先写公开 adapter 的字段/缺失能力映射，保留来源与限制，复用 neutral schema。不能为统一而伪造某个 harness 不提供的事件。
30. **进入 Anthropic 后研究什么？** 建立可观察失败的稳定标注基准，量化 hook 盲区/误报，设计工具错误与策略错误的可辨识实验，再评估 judge 与结构化观测的增量价值。

## 你必须能够现场演示

在干净 fixture 中安装插件，跑一个红测→修复→绿测任务，打开报告并解释一个真实事件。
展示并发与秘密脱敏测试，解释 `unknown` 为什么比猜测更有用。对于 upstream，只陈述实际
PR 状态，并能复现 Before FAIL / After PASS；未 merge 时使用 submitted。
