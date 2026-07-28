import { ChevronUp, PanelRight } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useWorkspaceStore } from '../../store';

const InspectorSection = ({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) => {
  const [expanded, setExpanded] = useState(true);
  return (
    <section className="inspector-section">
      <button className="section-title" onClick={() => setExpanded(value => !value)} type="button">
        <span>{title} <b>{count}</b></span><ChevronUp className={expanded ? '' : 'rotated'} />
      </button>
      {expanded ? children : null}
    </section>
  );
};

const Constraint = ({ icon, title, detail }: { icon: string; title: string; detail: string }) => (
  <div>
    <span className="constraint-icon">{icon}</span>
    <span><strong>{title}</strong><small>{detail}</small></span>
  </div>
);

export function TaskInspector() {
  const { inspectorCollapsed, toggleInspector } = useWorkspaceStore();
  return (
    <aside className="inspector">
      <header className="inspector-header">
        <button
          className="icon-button inspector-toggle"
          aria-expanded={!inspectorCollapsed}
          aria-label={inspectorCollapsed ? '展开任务侧栏' : '收起任务侧栏'}
          onClick={toggleInspector}
          type="button"
        >
          <PanelRight />
        </button>
      </header>
      <div className="inspector-scroll">
        <InspectorSection title="资源" count={0}>
          <p className="inspector-empty-copy">还没有添加资源</p>
          <button className="add-source" type="button">＋ 添加资源</button>
        </InspectorSection>
        <InspectorSection title="约束" count={1}>
          <div className="constraint-list">
            <Constraint icon="!" title="修改前需要审批" detail="任何写入操作均先展示变更方案" />
          </div>
          <button className="add-source" type="button">＋ 添加约束</button>
        </InspectorSection>
        <InspectorSection title="交付包" count={0}>
          <p className="inspector-empty-copy">任务产物会自动归集到这里</p>
        </InspectorSection>
      </div>
    </aside>
  );
}
