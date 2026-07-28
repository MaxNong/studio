import { CircleStop, PencilLine, Terminal } from 'lucide-react';
import { useEffect, useRef } from 'react';
import type { TaskRecord } from '../../store';

type MessageSegment =
  | { kind: 'text'; content: string }
  | { kind: 'code'; content: string; language: string };

const parseMessageContent = (content: string): MessageSegment[] => {
  const normalized = content.replace(/\r\n/g, '\n');
  const segments: MessageSegment[] = [];
  const fencePattern = /^```([^\n`]*)\n([\s\S]*?)(?:\n```|$)/gm;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = fencePattern.exec(normalized)) !== null) {
    if (match.index > cursor) {
      segments.push({ kind: 'text', content: normalized.slice(cursor, match.index) });
    }
    segments.push({
      kind: 'code',
      language: match[1]?.trim() ?? '',
      content: match[2] ?? '',
    });
    cursor = fencePattern.lastIndex;
  }

  if (cursor < normalized.length) {
    segments.push({ kind: 'text', content: normalized.slice(cursor) });
  }

  return segments.length > 0 ? segments : [{ kind: 'text', content: normalized }];
};

const MessageText = ({ content }: { content: string }) => {
  const blocks = content.split(/\n{2,}/).filter(block => block.length > 0);
  return blocks.map((block, blockIndex) => (
    <p key={`${block.slice(0, 24)}-${blockIndex}`}>
      {block.split(/(`[^`\n]+`)/g).map((part, partIndex) =>
        part.startsWith('`') && part.endsWith('`')
          ? <code key={`${part}-${partIndex}`}>{part.slice(1, -1)}</code>
          : <span key={`${part.slice(0, 16)}-${partIndex}`}>{part}</span>)}
    </p>
  ));
};

const MessageContent = ({ content }: { content: string }) => (
  <div className="message-body">
    {parseMessageContent(content).map((segment, segmentIndex) => {
      if (segment.kind === 'code') {
        return (
          <figure className="message-code-block" key={`code-${segmentIndex}`}>
            {segment.language ? <figcaption>{segment.language}</figcaption> : null}
            <pre><code>{segment.content}</code></pre>
          </figure>
        );
      }
      return <MessageText content={segment.content} key={`text-${segmentIndex}`} />;
    })}
  </div>
);

export function TaskWorkspace({ task }: { task: TaskRecord }) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const lastMessageLength = task.messages.at(-1)?.content.length ?? 0;
  const activityCount = task.activities.length;
  const approvalCount = task.approvals.length;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const frame = requestAnimationFrame(() => {
      canvas.scrollTo({ top: canvas.scrollHeight, behavior: 'auto' });
    });
    return () => cancelAnimationFrame(frame);
  }, [lastMessageLength, activityCount, approvalCount]);

  const running = task.runStatus === 'starting' || task.runStatus === 'running';
  const providerLabel = task.providerId === 'local-codex' ? '本地 Codex' : '企业 API Key';

  return (
    <div className="task-canvas" ref={canvasRef}>
      <section className="task-brief">
        <div className="brief-heading">
          <div>
            <span className="eyebrow">任务目标</span>
            <h1>{task.objective}</h1>
          </div>
          <span className="priority-chip">P1 · 今天</span>
        </div>
        <p>对话由 {providerLabel} 实际执行，运行过程、工具活动和最终回答会持续更新。</p>
      </section>

      <section className="execution-section">
        <div className="execution-header">
          <div>
            <span className="eyebrow">任务对话</span>
            <span className={`run-state ${task.runStatus}`}>{task.detail}</span>
          </div>
          <div className="execution-actions">
            <button
              className="stop-button"
              disabled={!running}
              onClick={() => void window.workStudio.agent.cancel(task.id)}
              type="button"
            >
              <CircleStop />停止
            </button>
          </div>
        </div>

        <div className="conversation">
          {task.messages.map(message => (
            <article className={`conversation-message ${message.role}`} key={message.id}>
              <MessageContent content={message.content} />
            </article>
          ))}
          {task.activities.length > 0 ? (
            <details className="agent-activities">
              <summary>执行记录 <span>{task.activities.length}</span></summary>
              <div className="activity-list">
                {task.activities.map(activity => (
                  <div key={activity.id}>
                    <span />
                    <strong>{activity.title}</strong>
                    {activity.detail ? <code>{activity.detail}</code> : null}
                  </div>
                ))}
              </div>
            </details>
          ) : null}
          {task.approvals.map(approval => (
            <div className="approval-card" key={approval.id}>
              <header>
                {approval.kind === 'file-change' ? <PencilLine /> : <Terminal />}
                <span>{approval.kind === 'file-change' ? '编辑文件' : '执行命令'}</span>
              </header>
              <p>{approval.kind === 'file-change' ? '是否允许编辑以下文件？' : '是否允许执行以下命令？'}</p>
              {approval.detail ? <div className="approval-detail"><code>{approval.detail}</code></div> : null}
              <footer className="approval-actions">
                <button
                  onClick={() => void window.workStudio.agent.resolveApproval(task.id, approval.id, 'decline')}
                  type="button"
                >
                  拒绝
                </button>
                <button
                  className="approve"
                  onClick={() => void window.workStudio.agent.resolveApproval(task.id, approval.id, 'accept')}
                  type="button"
                >
                  允许一次
                </button>
              </footer>
            </div>
          ))}
          {running && !task.messages.some(message => message.id === `assistant-${task.activeRunId}`) ? (
            <div className="assistant-pending"><span className="spinner" />正在思考…</div>
          ) : null}
          {task.error ? (
            <div className="run-error">
              <strong>执行失败</strong>
              <span>{task.error.message}</span>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
