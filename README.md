# XT Work Studio

以任务为起点的 Electron AI 工作台。当前已接通本地 Codex app-server 与 OpenAI-compatible 公司 API，可进行真实的流式多轮对话、停止运行和命令/文件修改审批。

## 开发

```bash
yarn install
yarn dev
```

## 校验

```bash
yarn typecheck
yarn build
```

`npm run build` 会在 `out/` 下生成可直接运行的 Electron 应用。公司 API Key 通过系统安全存储加密，明文不会进入 Renderer。

## 目录

```text
electron/         Electron Main、IPC handlers、preload 与本地存储
electron/agents/  Codex app-server 与 LangChain Agent Provider
src/renderer/     React 工作台
src/shared/       跨进程契约
design/           可交互设计稿
scripts/          端到端 smoke 工具
```

技术架构和后续阶段见 [TECHNICAL_SOLUTION.md](./TECHNICAL_SOLUTION.md)。
