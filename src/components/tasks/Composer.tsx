import { ChevronUp, Code2, Database, Plus, Send } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppHealth, ProviderId } from '../../shared/contracts';
import { useWorkspaceStore, type TaskRecord } from '../../store';

interface ComposerProps {
  health: AppHealth | null;
  newTask: boolean;
  task?: TaskRecord;
}

export function Composer({ health, newTask, task }: ComposerProps) {
  const [value, setValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [providerMenuOpen, setProviderMenuOpen] = useState(false);
  const navigate = useNavigate();
  const {
    providerId,
    setProvider,
    createTask,
    appendUserMessage,
    markRunFailed,
  } = useWorkspaceStore();
  const running = task?.runStatus === 'starting' || task?.runStatus === 'running';
  const taskCompleted = task?.status === 'completed';
  const effectiveProviderId = task?.providerId ?? providerId;
  const providerHealth = health?.providers[effectiveProviderId];

  const selectProvider = (nextProviderId: ProviderId) => {
    setProvider(nextProviderId);
    setProviderMenuOpen(false);
    if (nextProviderId === 'company-api' && health?.providers['company-api'].status !== 'connected') {
      navigate('/settings/company');
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const prompt = value.trim();
    if (!prompt || submitting || running || taskCompleted) return;
    setSubmitting(true);
    let taskId = task?.id;
    if (newTask) {
      taskId = createTask(prompt, effectiveProviderId);
      navigate(`/tasks/${taskId}`);
    } else if (taskId) {
      appendUserMessage(taskId, prompt, effectiveProviderId);
    }
    setValue('');
    if (!taskId) {
      setSubmitting(false);
      return;
    }

    const result = await window.workStudio.agent.run({
      taskId,
      prompt,
      providerId: effectiveProviderId,
    });
    if (!result.success) {
      markRunFailed(taskId, result.error);
      if (result.error.code === 'NOT_CONFIGURED') navigate('/settings/company');
    }
    setSubmitting(false);
  };

  return (
    <div className="composer-wrap">
      <form className="composer" onSubmit={event => void submit(event)}>
        <textarea
          value={value}
          disabled={running || taskCompleted}
          onChange={event => setValue(event.target.value)}
          onKeyDown={event => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder={taskCompleted
            ? '任务已结束，重新打开后可以继续追问'
            : running
            ? `${task?.providerId === 'company-api' ? '企业 API' : 'Codex'} 正在执行当前任务…`
            : newTask ? '描述你想完成的任务…' : '补充要求，或继续追问当前任务…'}
        />
        <div className="composer-footer">
          <div className="composer-tools">
            <button className="round-add" type="button"><Plus /></button>
            <div className="provider-picker">
              <button
                className={`runner-select${effectiveProviderId === 'company-api' ? ' company-runner' : ''}`}
                disabled={running || taskCompleted || !newTask}
                aria-expanded={providerMenuOpen}
                onClick={() => setProviderMenuOpen(value => !value)}
                type="button"
              >
                {effectiveProviderId === 'local-codex' ? <Code2 /> : <Database />}
                {effectiveProviderId === 'local-codex' ? '本地 Codex' : '企业 API Key'}
                <ChevronUp className={providerMenuOpen ? '' : 'provider-chevron'} />
              </button>
              {providerMenuOpen && newTask ? (
                <div className="provider-menu">
                  <button
                    className={effectiveProviderId === 'local-codex' ? 'selected' : ''}
                    onClick={() => selectProvider('local-codex')}
                    type="button"
                  >
                    <span className="provider-option-icon"><Code2 /></span>
                    <span><strong>本地 Codex</strong><small>访问本地仓库与工具</small></span>
                    <i className={health?.providers['local-codex'].status ?? 'checking'} />
                  </button>
                  <button
                    className={effectiveProviderId === 'company-api' ? 'selected' : ''}
                    onClick={() => selectProvider('company-api')}
                    type="button"
                  >
                    <span className="provider-option-icon company"><Database /></span>
                    <span>
                      <strong>企业 API Key</strong>
                      <small>{health?.providers['company-api'].status === 'connected' ? '已配置企业网关' : '需要配置网关与密钥'}</small>
                    </span>
                    <i className={health?.providers['company-api'].status ?? 'checking'} />
                  </button>
                </div>
              ) : null}
            </div>
            <span className={`connection-state ${providerHealth?.status ?? 'checking'}`}>
              <i />
              {providerHealth?.status === 'connected'
                ? '已连接'
                : providerHealth?.status === 'not_configured' ? '未配置' : providerHealth ? '不可用' : '检测中'}
            </span>
            <span className="permission"><i />工作区权限</span>
          </div>
          <div className="composer-submit">
            <span className="submit-shortcut">⌘ ↵</span>
            <button
              className="send-button"
              aria-label="发送"
              disabled={!value.trim() || submitting || running || taskCompleted}
              type="submit"
            >
              <Send />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
