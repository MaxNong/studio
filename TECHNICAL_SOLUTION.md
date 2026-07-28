# XT Work Studio 技术方案

> 状态：Draft  
> 更新时间：2026-07-28  
> 目标版本：MVP

## 1. 背景与目标

XT Work Studio 是一个以任务为起点的桌面工作台。任务可以是编码、调研或内部资料问答；用户只需要描述目标、选择资源和约束，系统负责选择执行后端、组织上下文、展示过程并沉淀交付物。

MVP 需要同时支持两类执行后端：

1. 本地 Codex：通过 `codex app-server` 驱动本地仓库、命令和工具调用。
2. 公司 API：使用用户配置的企业网关与 API Key 完成内部资料查询、分析和通用推理。

本方案重点解决：

- 一个任务关联多个仓库、文档、知识集合和外部系统。
- 一个任务可在不同执行后端之间切换，且 UI 使用统一的任务事件模型。
- 审批、约束和敏感资源访问可审计。
- 插件、技能可发现、可管理、可被任务复用。
- 交付物不绑定单一仓库，可聚合多个变更集、报告和引用。

## 2. 范围

### 2.1 MVP 范围

- 桌面端任务工作台。
- 任务创建、状态分组、执行、暂停、恢复和归档。
- 本地 Codex app-server 接入。
- 公司 API Key 配置与公司网关接入。
- 多资源、多约束、多交付物的数据模型。
- 知识库、插件、技能和设置页面。
- 本地持久化、凭证安全存储、运行日志和基础审计。

### 2.2 暂不纳入

- 云端多人实时协作编辑。
- 跨设备同步完整任务记录。
- 自研模型推理服务。
- 插件市场交易、计费和公开发布审核。
- 无人值守的高风险生产变更。

## 3. 技术选型

| 层级 | 选型 | 说明 |
| --- | --- | --- |
| 桌面容器 | Electron + Electron Forge | Chromium 渲染一致，Node.js 生态便于进程、文件和企业 SDK 集成 |
| 前端 | React 19 + TypeScript + Vite | 组件化实现任务流、事件流和多路由工作台 |
| UI 状态 | Zustand | 管理当前任务、筛选条件、弹窗和短生命周期状态 |
| 服务端状态 | TanStack Query | 管理命令查询、缓存、失效和重试 |
| 路由 | React Router | 任务、知识库、插件、技能和设置路由 |
| 桌面核心 | Electron Main + Node.js + TypeScript | 管理 app-server 子进程、JSONL 流、文件访问和任务事件分发 |
| 企业 Agent | LangChain `createAgent` + `ChatOpenAI` + `MemorySaver` | 接入 OpenAI-compatible 企业网关，提供流式多轮会话 |
| 本地数据库 | SQLite + better-sqlite3 | 存储任务、资源索引、事件、运行记录和交付物元数据 |
| 密钥存储 | Electron `safeStorage` | 使用操作系统提供的加密能力，前端不接触 API Key 明文 |
| 内容索引 | SQLite FTS5，后续可扩展向量索引 | MVP 先满足本地全文检索和来源过滤 |
| 日志与观测 | Pino + rotating-file-stream | 结构化日志，支持 task/run/provider 维度定位 |
| 测试 | Vitest + React Testing Library + Playwright | 覆盖组件、协议适配、迁移和关键端到端流程 |

选择 Electron 而不是纯 Web 的核心原因，是本地 Codex 接入需要可靠地管理子进程、工作目录、标准输入输出和系统权限。Electron Main 可以直接复用 Node.js 生态，降低团队接入 app-server、公司 SDK 和插件系统的成本。Renderer 必须保持浏览器安全边界，不能直接获得 Node.js、企业 API Key 或任意 IPC 能力。

桌面应用内部按运行时边界组织目录：根目录 `electron/` 只放主进程、preload、IPC 和本地系统能力，`src/renderer/` 只放 React 界面，双方通过 `src/shared/contracts.ts` 中的类型化桥接协议交互。当前仓库只有一个桌面应用，因此不额外保留 `apps/desktop/` 层级。

## 4. 总体架构

```text
┌──────────────────── Electron Renderer ─────────────────────┐
│ Task / Knowledge / Plugins / Skills / Settings             │
│ React Query + Zustand + unified TaskEvent renderer          │
└───────────────────────────┬─────────────────────────────────┘
                   contextBridge allowlist
┌───────────────────────────▼─────────────────────────────────┐
│ Preload: typed window.workStudio API                        │
└───────────────────────────┬─────────────────────────────────┘
                       Electron IPC
┌───────────────────────────▼─────────────────────────────────┐
│ Electron Main                                               │
│ TaskService  ResourceService  ApprovalService  ArtifactSvc  │
│ ProviderRouter  PluginRegistry  SkillRegistry  AuditService │
└───────────────┬───────────────────────┬─────────────────────┘
                │                       │
       ┌────────▼─────────┐    ┌────────▼──────────┐
       │ LocalCodexAdapter│    │ CompanyApiAdapter │
       │ app-server/stdio │    │ HTTPS + SSE/stream│
       └────────┬─────────┘    └────────┬──────────┘
                │                       │
       Local repos / tools       Company gateway / KB

Shared persistence:
SQLite metadata + encrypted OS credential store + task artifact directory
```

前端只消费统一的 `TaskEvent`，不直接解析 Codex JSON-RPC 或公司 API 流。所有供应商差异收敛在 Provider Adapter 内。

## 5. 核心领域模型

### 5.1 Task

```ts
type TaskStatus =
  | 'draft'
  | 'running'
  | 'waiting_for_user'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'archived';

interface Task {
  id: string;
  title: string;
  objective: string;
  type: 'coding' | 'research' | 'knowledge_qa' | 'mixed';
  status: TaskStatus;
  defaultProviderId?: string;
  createdAt: string;
  updatedAt: string;
}
```

左侧任务栏按状态投影，不额外维护“待我处理”实体：

- 进行中：`running`、`paused`
- 待确认：`waiting_for_user`
- 最近任务：`completed`、`failed`、`archived`

### 5.2 Run

一个任务可以执行多次，也可以先由公司 API 调研，再交给本地 Codex 修改代码。

```ts
interface TaskRun {
  id: string;
  taskId: string;
  providerId: string;
  providerThreadId?: string;
  status: 'queued' | 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  startedAt?: string;
  finishedAt?: string;
}
```

### 5.3 Resource 与 Reference

“资源”表示任务可访问的上下文，不把仓库当作任务的唯一容器。

```ts
type ResourceKind =
  | 'repository'
  | 'file'
  | 'document'
  | 'knowledge_collection'
  | 'web_page'
  | 'mcp_server'
  | 'data_source';

interface TaskResource {
  id: string;
  taskId: string;
  kind: ResourceKind;
  uri: string;
  label: string;
  accessMode: 'read' | 'write';
  metadata: Record<string, unknown>;
}
```

一个任务可关联任意数量的资源。执行时由 `ContextAssembler` 根据任务目标、权限和预算选取相关片段；未被注入模型的资源仍保留在任务资源列表中。

Reference 是某次结论使用的具体证据，必须记录来源、定位信息和抓取时间：

```ts
interface Reference {
  id: string;
  runId: string;
  resourceId: string;
  locator: string;
  title?: string;
  excerpt?: string;
  capturedAt: string;
}
```

### 5.4 Constraint

约束独立于提示词，便于执行前检查和审计：

- 文件系统读写范围。
- 网络域名范围。
- 允许或禁止执行的命令类型。
- 必须审批的动作。
- 输出格式、时间和成本预算。
- 公司数据分级与外发限制。

约束按“组织策略 > 工作区策略 > 任务策略”合并；上层禁止项不可被下层放宽。

### 5.5 Artifact 与 ChangeSet

交付物采用组合模型：

```ts
interface Artifact {
  id: string;
  taskId: string;
  runId?: string;
  kind: 'report' | 'document' | 'patch' | 'change_set' | 'dataset' | 'link';
  title: string;
  uri?: string;
  status: 'draft' | 'verified' | 'delivered';
}

interface ChangeSetEntry {
  artifactId: string;
  repositoryResourceId: string;
  branch?: string;
  commit?: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
}
```

因此，一个“代码变更集”可以覆盖多个仓库；调研报告也可以包含多个 Reference，不再使用单仓库、单参考的交付物假设。

## 6. 执行后端抽象

```ts
interface ExecutionProvider {
  id: string;
  capabilities(): Promise<ProviderCapabilities>;
  healthCheck(): Promise<ProviderHealth>;
  startRun(input: StartRunInput): Promise<RunHandle>;
  resumeRun(input: ResumeRunInput): Promise<RunHandle>;
  steerRun(runId: string, input: UserInput): Promise<void>;
  cancelRun(runId: string): Promise<void>;
  events(runId: string): AsyncIterable<TaskEvent>;
}
```

`ProviderCapabilities` 至少声明：

- 是否支持本地文件读写。
- 是否支持命令执行。
- 是否支持会话恢复。
- 是否支持结构化工具调用。
- 是否支持审批回调。
- 可用模型与上下文限制。

路由策略：

1. 用户在输入框显式选择后端时，尊重用户选择。
2. 未选择时，编码且包含可写仓库资源的任务优先本地 Codex。
3. 内部知识集合查询优先公司 API。
4. 混合任务拆分为多个 Run，并在任务事件流中串联。
5. 后端不可用时只建议可行替代，不自动把内部资料发送到外部服务。

## 7. 本地 Codex app-server 接入

Codex app-server 适合富客户端集成，提供认证、会话历史、审批和流式 Agent 事件。其协议为双向 JSON-RPC 2.0 风格消息；默认 `stdio` 使用逐行 JSON，WebSocket 当前属于实验性能力。因此 MVP 固定使用本机 `stdio`，不暴露网络监听端口。参考：[Codex App Server 官方说明](https://learn.chatgpt.com/docs/app-server.md)。

### 7.1 生命周期

1. Desktop Core 检测用户配置的 `codex` 可执行文件和版本。
2. 启动 `codex app-server` 子进程，绑定 stdin/stdout/stderr。
3. 发送一次 `initialize`，收到响应后发送 `initialized`。
4. 新任务 Run 调用 `thread/start`；恢复任务调用 `thread/resume`。
5. 用户输入调用 `turn/start`；运行中补充信息调用 `turn/steer`。
6. 持续消费 item、tool、approval 和 turn 通知，映射为统一 `TaskEvent`。
7. 用户停止任务时调用 `turn/interrupt`。
8. 进程异常退出时保存最后事件游标，重启后尝试恢复 thread。

### 7.2 版本与 Schema

- 首次启动记录 Codex 版本。
- 使用当前安装版本生成或校验协议 Schema，避免假设不同版本字段完全一致。
- Adapter 对未知通知采取“记录并忽略”，不能导致整个事件流崩溃。
- 稳定版本默认不启用 `experimentalApi`。
- App-server 升级后执行协议契约测试，再允许进入正式任务。

### 7.3 进程安全

- 每个工作台实例只维护一个 app-server 连接，由线程复用。
- stderr 单独写入脱敏日志。
- 子进程继承最小环境变量集合。
- 工作目录由 Run 明确传入，不使用隐式全局 cwd。
- 任务资源中未授权的目录不加入可写范围。
- 所有审批请求进入 `ApprovalService`，不能由 Adapter 自动同意。

## 8. 公司 API 接入

MVP 公司 API 通过 `CompanyApiAdapter` 接入 OpenAI-compatible 企业网关，使用 LangChain `createAgent` 维护 Agent Loop，并由 `MemorySaver` 按任务保存进程内会话状态。非 OpenAI-compatible 的自定义协议后续通过独立 Adapter 扩展，不混入当前实现。

### 8.1 配置

```ts
interface CompanyApiProfile {
  id: string;
  name: string;
  baseUrl: string;
  protocol: 'responses_compatible' | 'chat_compatible' | 'custom';
  model: string;
  authRef: string;
  allowedResourceKinds: ResourceKind[];
}
```

`authRef` 只引用由 Electron `safeStorage` 加密后的凭证条目。Renderer 和 SQLite 均不保存 Key 明文；SQLite 仅保存加密后的二进制数据及其引用。

### 8.2 请求链路

```text
TaskRun
  -> Policy check
  -> ContextAssembler
  -> company request mapper
  -> HTTPS request / streaming response
  -> provider event parser
  -> unified TaskEvent
```

要求：

- 强制 HTTPS，并允许公司证书链配置。
- 设置连接、首包和总执行超时。
- 对 429、502、503 使用有上限的指数退避。
- 请求携带 `task_id`、`run_id`、`trace_id`，但不携带本地绝对路径等无关信息。
- 日志默认不记录请求正文、API Key 和内部资料原文。
- 根据公司网关能力实现 SSE、JSONL 或非流式降级。

当前实现使用 `ChatOpenAI` 的流式消息模式，关闭额外的 usage chunk 以兼容常见企业代理；网关地址、模型和 API Key 均从 Electron Main 读取，Renderer 只接收脱敏后的配置状态。

## 9. 统一任务事件

```ts
type TaskEvent =
  | { type: 'run.started'; runId: string; timestamp: string }
  | { type: 'message.delta'; text: string; timestamp: string }
  | { type: 'step.started'; stepId: string; title: string; timestamp: string }
  | { type: 'step.completed'; stepId: string; summary?: string; timestamp: string }
  | { type: 'tool.started'; tool: string; inputSummary?: string; timestamp: string }
  | { type: 'tool.completed'; tool: string; outputSummary?: string; timestamp: string }
  | { type: 'reference.added'; referenceId: string; timestamp: string }
  | { type: 'artifact.updated'; artifactId: string; timestamp: string }
  | { type: 'approval.required'; approvalId: string; timestamp: string }
  | { type: 'run.completed'; status: string; timestamp: string }
  | { type: 'run.failed'; code: string; message: string; retryable: boolean; timestamp: string };
```

事件先落库再推送 UI。前端断开重连后从最后一个 event sequence 补齐，避免长任务过程丢失。

## 10. 插件与技能

### 10.1 Skill

Skill 是可复用任务流程，核心文件为 `SKILL.md`。注册表保存：

- `id`、名称、描述和来源。
- 文件路径与内容摘要。
- Skill 依赖、MCP 依赖。
- 是否被组织策略允许。
- 最近扫描时间和解析错误。

扫描来源：

1. 当前工作区技能目录。
2. 用户级技能目录。
3. 已安装插件提供的技能。

扫描过程在 Electron Main 的 Extension Worker 中执行，只读取允许的目录；文件变化通过 watcher 增量刷新。

### 10.2 Plugin

Plugin 是可安装的能力包，可以包含技能、MCP 配置、应用连接器、资源和其他扩展。管理页展示启用状态、能力摘要、来源和错误。

插件启停不直接修改运行中的 Run：

- 新 Run 使用最新快照。
- 运行中的 Run 保持创建时的能力快照。
- 插件配置变化后触发 MCP 配置重载；失败则回滚启用状态并展示原因。

### 10.3 权限

- 插件声明权限不等于获得权限。
- 安装、首次启用或权限扩大时必须展示差异。
- 组织禁用的插件和技能不可由个人重新开启。
- 插件调用产生的外部写操作进入统一审批链。

## 11. 知识库

知识库负责管理可复用资料集合，而不是保存对话本身。

```text
Collection
  ├─ Source: repository
  ├─ Source: document
  ├─ Source: API/data source
  └─ Index versions
```

MVP 流程：

1. 连接来源并记录权限。
2. 抽取标题、路径、更新时间和可检索正文。
3. 写入 FTS5，保留 source locator。
4. 查询时先进行权限过滤，再检索。
5. 选中的结果转为 Task Resource 和 Reference。

公司内部资料默认只能发送到公司 API。若用户切换到其他后端，Policy Engine 必须在执行前阻止不允许的数据流向。

## 12. 存储设计

SQLite 主要表：

- `tasks`
- `task_runs`
- `task_resources`
- `task_constraints`
- `task_events`
- `references`
- `artifacts`
- `change_set_entries`
- `knowledge_collections`
- `knowledge_sources`
- `skill_registry`
- `plugin_registry`
- `provider_profiles`
- `approvals`
- `audit_logs`

大文本和二进制交付物存放到应用数据目录：

```text
app-data/
  database/work-studio.sqlite
  artifacts/{task_id}/{artifact_id}/
  indexes/{collection_id}/
  logs/
```

数据库只保存相对路径和校验值。迁移使用单向版本号，每次启动先备份数据库元数据再执行迁移。

## 13. 安全设计

### 13.1 凭证

- API Key 在 Electron Main 中通过 `safeStorage.encryptString` 加密后持久化。
- 启动时检查 `safeStorage.isEncryptionAvailable()`；操作系统安全存储不可用时禁止保存公司 API Key，而不是降级为明文。
- UI 只显示“已配置”和末尾少量字符，不支持读取回明文。
- 导出设置时不包含凭证。
- 日志和错误对象经过统一脱敏器。

### 13.2 权限与审批

审批对象至少包含：

- 发起 Run 和 Provider。
- 动作类型及目标。
- 影响范围。
- 触发该动作的步骤。
- 允许一次、允许本次 Run、拒绝三种结果。

高风险动作不提供“永久允许”：

- 写入工作区外目录。
- 推送远程分支、创建或合并 PR。
- 访问未声明网络域名。
- 删除文件或执行不可恢复操作。
- 将内部资料发送到非公司 Provider。

### 13.3 审计

审计日志采用 append-only 语义，记录配置变更、资源授权、审批结果、插件启停和任务交付，不记录 API Key 与完整敏感正文。

## 14. Electron 进程与 IPC 边界

Electron 按以下进程职责拆分：

- Renderer：只负责展示和收集用户输入。
- Preload：通过 `contextBridge` 暴露类型明确的最小 API。
- Main：窗口生命周期、IPC 鉴权、Provider 编排、子进程和系统能力。
- Utility Process / Worker：数据库、索引和大文本解析等可能阻塞 Main 的工作。
- `codex app-server`：由 Main 使用 `child_process.spawn` 启动的独立进程。

BrowserWindow 安全基线：

```ts
new BrowserWindow({
  webPreferences: {
    preload: PRELOAD_PATH,
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
  },
});
```

Preload 仅暴露领域动作，不暴露原始 `ipcRenderer`：

```ts
interface WorkStudioApi {
  tasks: {
    create(input: CreateTaskInput): Promise<Task>;
    list(query?: TaskQuery): Promise<Task[]>;
    start(taskId: string, input: StartRunInput): Promise<TaskRun>;
    steer(runId: string, input: UserInput): Promise<void>;
    cancel(runId: string): Promise<void>;
    subscribe(listener: (event: TaskEvent) => void): () => void;
  };
  resources: {
    attach(input: AttachResourceInput): Promise<TaskResource>;
    detach(resourceId: string): Promise<void>;
  };
  approvals: {
    resolve(id: string, decision: ApprovalDecision): Promise<void>;
  };
  providers: {
    list(): Promise<ProviderSummary[]>;
    healthCheck(id: string): Promise<ProviderHealth>;
    saveProfile(input: ProviderProfileInput): Promise<void>;
  };
  plugins: {
    list(): Promise<PluginDefinition[]>;
    setEnabled(id: string, enabled: boolean): Promise<void>;
  };
  skills: {
    list(): Promise<SkillDefinition[]>;
    read(id: string): Promise<SkillContent>;
  };
}
```

IPC 约束：

- Channel 使用固定白名单，不接受 Renderer 传入动态 channel。
- Main 对每个 payload 做 Schema 校验，并重新检查路径和资源权限。
- Renderer 传入的绝对路径、命令和 URL 一律视为不可信数据。
- 事件通道名固定为 `task:event`，payload 必须包含 `taskId`、`runId` 和单调递增的 `sequence`。
- 页面导航只允许打包资源；外部链接交给系统浏览器，并执行 URL allowlist 检查。

## 15. 工程目录建议

```text
xt-work-studio/
  apps/
    desktop/
      src/
        main/              # Electron Main、服务和 IPC handlers
        preload/           # contextBridge allowlist
        renderer/          # React UI
        workers/           # SQLite、索引和内容解析
      forge.config.ts
  packages/
    domain/                # Task/Run/Resource/Event 类型
    ui/                    # 通用 UI 组件与 tokens
    provider-contract/     # Provider 接口与协议测试
    task-core/
    codex-adapter/
    company-api-adapter/
    policy-engine/
    storage/
    extension-registry/
  design/                  # 当前可交互设计稿
  docs/
  TECHNICAL_SOLUTION.md
```

所有进程共享 `packages/domain` 中的 TypeScript 类型，并在 IPC 入口使用 Zod 或 JSON Schema 做运行时校验，避免“类型存在但运行时数据不可信”。

## 16. 可观测性与错误处理

每次 Run 生成 `trace_id`，日志字段统一包含：

```text
timestamp, level, task_id, run_id, provider_id, trace_id, event, duration_ms
```

错误分为：

- `configuration_error`：路径、Key 或网关配置不完整。
- `provider_unavailable`：app-server 或公司网关不可用。
- `permission_denied`：策略或用户拒绝。
- `protocol_error`：事件格式或版本不兼容。
- `execution_error`：工具、命令或模型执行失败。
- `storage_error`：数据库或交付物写入失败。

UI 应展示用户可采取的下一步，并把技术细节折叠在日志中。

## 17. 测试策略

### 17.1 单元测试

- Task 状态机和状态分组。
- Provider 路由规则。
- 约束合并与数据外发策略。
- Codex 消息到 `TaskEvent` 的映射。
- 公司 API 流式分片解析。
- Skill / Plugin manifest 解析。

### 17.2 契约测试

- 使用录制的 app-server JSONL 检查版本兼容。
- 使用 mock company gateway 覆盖 SSE、限流、超时和异常响应。
- Main、Preload、Renderer 三端 IPC Schema 一致性校验。

### 17.3 端到端测试

1. 新建编码任务，关联两个仓库，执行并生成多仓库 ChangeSet。
2. 新建内部资料调研任务，生成包含多个 Reference 的报告。
3. 运行中触发审批，拒绝后任务正确进入待确认状态。
4. app-server 异常退出后恢复线程。
5. API Key 更新后旧凭证不可继续使用。
6. 插件停用后，新任务不再获得对应能力。

## 18. 交付阶段

### Phase 0：工程骨架

- Electron Forge、React、SQLite、Preload 安全桥、日志和基础路由。
- 将 `design/` 中的页面拆成正式组件与 design tokens。

### Phase 1：任务闭环

- Task / Run / Event 数据模型。
- 本地 Codex stdio Adapter。
- 任务创建、流式执行、停止、审批和恢复。

### Phase 2：公司 API 与资源

- 公司网关配置、Electron `safeStorage` 凭证存储。
- CompanyApiAdapter。
- 多资源、Reference、Constraint 与数据外发策略。

### Phase 3：知识库与交付物

- Collection / Source 管理和 FTS5。
- 报告、多仓库 ChangeSet 和交付验证。

### Phase 4：插件与技能

- 本地扫描、依赖展示、启停和热更新。
- Skill 预览与带入任务。
- 组织策略入口。

## 19. 关键风险与应对

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| Codex app-server 随版本演进 | 协议解析失败 | 版本检测、生成 Schema、契约测试、未知事件容错 |
| 公司 API 协议不统一 | Adapter 复杂度增加 | 配置化协议类型，自定义 Mapper 与统一事件层 |
| 内部资料误发到外部后端 | 数据安全事故 | Provider 前置策略检查，默认拒绝跨边界发送 |
| 长任务事件量大 | SQLite 和 UI 性能下降 | 事件批量写入、虚拟列表、增量摘要与归档 |
| 多仓库写操作难回滚 | 交付不一致 | 每仓库独立 ChangeSet，验证后再标记整体交付 |
| 插件权限扩大 | 本地或数据安全风险 | 权限声明、差异审批、组织策略、运行快照 |

## 20. 验收标准

- 本地 Codex 与公司 API 均可从输入框切换并完成一次任务。
- 同一任务可关联至少两个仓库和多个参考来源。
- 任务事件在刷新页面后可完整恢复。
- 所有高风险动作均可触发审批并被审计。
- API Key 不出现在数据库、前端存储和日志中。
- app-server 退出后 UI 能给出明确状态并支持恢复。
- 插件和技能可搜索、查看来源、检查依赖和启停或使用。
- 交付包能同时展示报告、多仓库变更集及其验证状态。
