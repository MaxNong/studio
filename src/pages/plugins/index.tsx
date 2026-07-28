import { useMemo, useState } from 'react';
import { CapabilityPage, CapabilityToolbar } from '../../components/capabilities/CapabilityPage';
import { plugins as initialPlugins } from '../../data/capability-catalog';

export function PluginsPage() {
  const [items, setItems] = useState(initialPlugins);
  const [query, setQuery] = useState('');
  const visible = useMemo(
    () => items.filter(item => item.name.toLowerCase().includes(query.toLowerCase())),
    [items, query],
  );

  return (
    <CapabilityPage eyebrow="扩展工作台能力" title="插件" description="插件把连接器、MCP 和技能组合成可管理的能力包。">
      <CapabilityToolbar query={query} setQuery={setQuery} placeholder="搜索插件" />
      <div className="plugin-grid">
        {visible.map(item => (
          <article className="plugin-card" key={item.id}>
            <header className="plugin-card-head">
              <span className="plugin-logo">{item.monogram}</span>
              <div><strong>{item.name}</strong><small>官方能力包</small></div>
              <button
                className={`toggle-switch${item.enabled ? ' on' : ''}`}
                aria-checked={item.enabled}
                onClick={() => setItems(current => current.map(plugin =>
                  plugin.id === item.id ? { ...plugin, enabled: !plugin.enabled } : plugin))}
                role="switch"
                type="button"
              >
                <i />
              </button>
            </header>
            <p>{item.detail}</p>
            <div className="plugin-capabilities">
              {item.skills.map(skill => <span key={skill}>{skill}</span>)}
            </div>
            <footer>
              <span className={`status-text${item.enabled ? '' : ' disabled'}`}>
                <i />{item.enabled ? '运行正常' : '已停用'}
              </span>
              <button className="plugin-detail-button" type="button">查看详情</button>
            </footer>
          </article>
        ))}
      </div>
    </CapabilityPage>
  );
}
