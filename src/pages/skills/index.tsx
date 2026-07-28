import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CapabilityPage, CapabilityToolbar } from '../../components/capabilities/CapabilityPage';
import { skills } from '../../data/capability-catalog';

export function SkillsPage() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const visible = skills.filter(skill => skill.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <CapabilityPage eyebrow="可复用任务流程" title="技能" description="技能把稳定的工作方法、依赖与执行约束沉淀为可复用流程。">
      <CapabilityToolbar query={query} setQuery={setQuery} placeholder="搜索技能、来源或依赖" />
      <div className="skill-list">
        {visible.map(skill => (
          <article className="skill-card" key={skill.name}>
            <span className="skill-logo">技</span>
            <div className="skill-card-body">
              <header>
                <strong>{skill.name}</strong>
                <span className={`source-badge ${skill.source === '工作区' ? 'workspace' : skill.source === '个人' ? 'personal' : 'system'}`}>
                  {skill.source}
                </span>
              </header>
              <p>{skill.detail}</p>
              <div className="dependency-row">
                <span>依赖</span>
                {skill.dependencies.map(item => <b key={item}>{item}</b>)}
              </div>
            </div>
            <div className="skill-actions">
              <button type="button">预览</button>
              <button className="use-skill" onClick={() => navigate('/tasks/new')} type="button">使用</button>
            </div>
          </article>
        ))}
      </div>
    </CapabilityPage>
  );
}
