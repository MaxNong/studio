import { Code2, Database, Settings, ShieldCheck, Sparkles } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import type { AppHealth, SettingsSnapshot } from '../../shared/contracts';

const settingsPanels = ['general', 'appearance', 'codex', 'company', 'about'] as const;
type SettingsPanel = typeof settingsPanels[number];

const SettingRow = ({
  title,
  detail,
  children,
}: {
  title: string;
  detail: string;
  children: ReactNode;
}) => (
  <div className="setting-row">
    <span><strong>{title}</strong><small>{detail}</small></span>
    {children}
  </div>
);

const GeneralSettings = () => (
  <>
    <SettingRow title="默认任务范围" detail="新任务默认可以访问的资源范围">
      <select defaultValue="selected">
        <option value="selected">仅已添加资源</option>
        <option value="workspace">当前工作区</option>
      </select>
    </SettingRow>
    <SettingRow title="完成通知" detail="任务完成或需要确认时发送系统通知">
      <button className="toggle-switch on" role="switch" aria-checked="true" type="button"><i /></button>
    </SettingRow>
  </>
);

const AppearanceSettings = () => (
  <div className="setting-group">
    <h3>主题</h3>
    <div className="theme-options">
      {['深色', '跟随系统', '浅色'].map((name, index) => (
        <button className={`theme-option${index === 0 ? ' active' : ''}`} key={name} type="button">
          <span className={`theme-preview ${index === 0 ? 'dark-preview' : index === 1 ? 'system-preview' : 'light-preview'}`} />
          <strong>{name}</strong>
        </button>
      ))}
    </div>
  </div>
);

const CodexSettings = ({ health }: { health?: AppHealth['providers']['local-codex'] }) => {
  const connected = health?.status === 'connected';
  return (
    <div>
      <div className="agent-health">
        <span className="plugin-logo codex-settings-logo"><Code2 /></span>
        <span>
          <strong>Codex app-server</strong>
          <small className={connected ? '' : 'unavailable'}>
            <i />{connected ? '本地进程已连接' : health?.detail ?? '本地 Codex 不可用'}
          </small>
        </span>
      </div>
      <label className="setting-field"><span>可执行文件</span><input value="codex" readOnly /></label>
      <label className="setting-field"><span>传输方式</span><input value="stdio · JSONL" readOnly /></label>
    </div>
  );
};

const AboutSettings = () => (
  <div className="about-panel">
    <span className="brand-mark large-mark"><span /><span /></span>
    <h2>XT Work Studio</h2>
    <p>以任务为起点的 AI 工作台</p>
    <div><span>桌面框架</span><b>Electron</b></div>
    <div><span>版本</span><b>0.1.0</b></div>
  </div>
);

export function SettingsPage() {
  const navigate = useNavigate();
  const { panel: routePanel } = useParams();
  const panel = settingsPanels.includes(routePanel as SettingsPanel)
    ? routePanel as SettingsPanel
    : null;
  const [settings, setSettings] = useState<SettingsSnapshot | null>(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [model, setModel] = useState('company-reasoning');
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [health, setHealth] = useState<AppHealth | null>(null);

  useEffect(() => {
    const refreshHealth = () => {
      void window.workStudio.getHealth().then(setHealth);
    };
    refreshHealth();
    window.addEventListener('work-studio:settings-changed', refreshHealth);
    void window.workStudio.getSettings().then(snapshot => {
      setSettings(snapshot);
      setBaseUrl(snapshot.companyApi.baseUrl);
      setModel(snapshot.companyApi.model);
    });
    return () => window.removeEventListener('work-studio:settings-changed', refreshHealth);
  }, []);

  if (!panel) return <Navigate replace to="/settings/general" />;

  const saveCompany = async () => {
    try {
      const next = await window.workStudio.saveCompanyApiSettings({
        baseUrl,
        model,
        apiKey: apiKey || undefined,
      });
      setSettings(next);
      setApiKey('');
      setMessage('企业 API Key 设置已保存');
      window.dispatchEvent(new Event('work-studio:settings-changed'));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '保存失败');
    }
  };

  const nav = [
    ['general', '通用', <Settings key="general" />],
    ['appearance', '外观', <Sparkles key="appearance" />],
    ['codex', '本地 Codex', <Code2 key="codex" />],
    ['company', '企业 API', <Database key="company" />],
    ['about', '关于', <ShieldCheck key="about" />],
  ] as const;

  return (
    <section className="settings-page">
      <div className="settings-page-shell">
        <nav className="settings-nav" aria-label="设置分类">
          <div className="settings-nav-title">工作台设置</div>
          <p className="settings-nav-description">管理工作方式、执行后端和应用信息。</p>
          {nav.map(([id, label, icon]) => (
            <button
              className={`settings-nav-item${panel === id ? ' active' : ''}`}
              key={id}
              onClick={() => navigate(`/settings/${id}`)}
              type="button"
            >
              {icon}<span>{label}</span>
            </button>
          ))}
        </nav>
        <div className="settings-content">
          <header className="settings-page-header">
            <span className="eyebrow">设置</span>
            <h1>{nav.find(([id]) => id === panel)?.[1]}</h1>
          </header>
          <div className="settings-panel">
            {panel === 'general' ? <GeneralSettings /> : null}
            {panel === 'appearance' ? <AppearanceSettings /> : null}
            {panel === 'codex' ? <CodexSettings health={health?.providers['local-codex']} /> : null}
            {panel === 'company' ? (
              <div>
                <div className="agent-health">
                  <span className="plugin-logo company-settings-logo">A</span>
                  <span>
                    <strong>企业 API Key</strong>
                    <small><i />{settings?.companyApi.hasApiKey ? '凭证已安全保存' : '尚未配置 API Key'}</small>
                  </span>
                </div>
                <label className="setting-field">
                  <span>网关地址</span>
                  <input value={baseUrl} onChange={event => setBaseUrl(event.target.value)} placeholder="https://api.company.example/v1" />
                </label>
                <label className="setting-field">
                  <span>API Key</span>
                  <input
                    value={apiKey}
                    onChange={event => setApiKey(event.target.value)}
                    placeholder={settings?.companyApi.hasApiKey ? '已配置，留空表示不修改' : '输入 API Key'}
                    type="password"
                  />
                </label>
                <label className="setting-field">
                  <span>默认模型</span>
                  <input value={model} onChange={event => setModel(event.target.value)} />
                </label>
                <div className="settings-save-row">
                  <span>{message}</span>
                  <button className="primary-action" onClick={() => void saveCompany()} type="button">保存设置</button>
                </div>
              </div>
            ) : null}
            {panel === 'about' ? <AboutSettings /> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
