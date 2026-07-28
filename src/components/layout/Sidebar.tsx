import {
  BookOpen,
  CircleAlert,
  CircleCheck,
  Folder,
  ListChecks,
  LoaderCircle,
  Plug,
  Plus,
  Search,
  Settings,
  Sparkles,
} from 'lucide-react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useWorkspaceStore, type TaskRecord } from '../../store';

const WindowControls = () => (
  <div className="window-controls" aria-label="窗口控制">
    <button className="window-control close" aria-label="关闭窗口" onClick={() => window.workStudio.windowControls.close()} type="button" />
    <button className="window-control minimize" aria-label="最小化窗口" onClick={() => window.workStudio.windowControls.minimize()} type="button" />
    <button className="window-control maximize" aria-label="进入或退出全屏" onClick={() => window.workStudio.windowControls.toggleFullScreen()} type="button" />
  </div>
);

const NavIcon = ({ kind }: { kind: 'knowledge' | 'plugins' | 'skills' }) => {
  if (kind === 'knowledge') return <BookOpen />;
  if (kind === 'plugins') return <Plug />;
  return <Sparkles />;
};

const taskState = (task: TaskRecord) => {
  if (task.status === 'completed') {
    return { icon: <CircleCheck />, label: '任务已结束', className: 'done' };
  }
  if (task.status === 'waiting' || task.runStatus === 'failed' || task.runStatus === 'interrupted') {
    return { icon: <CircleAlert />, label: '等待确认', className: 'waiting' };
  }
  if (task.runStatus === 'starting' || task.runStatus === 'running') {
    return { icon: <LoaderCircle />, label: '执行中', className: 'running' };
  }
  return { icon: <CircleCheck />, label: '本轮对话已结束', className: 'ready' };
};

const TaskStateIcon = ({ task }: { task: TaskRecord }) => {
  const state = taskState(task);
  return (
    <span className={`task-state-icon ${state.className}`} aria-label={state.label} title={state.label}>
      {state.icon}
    </span>
  );
};

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tasks, activeTaskId, setActiveTask } = useWorkspaceStore();
  const activeTasks = tasks.filter(task => task.status === 'running');
  const waitingTasks = tasks.filter(task => task.status === 'waiting');
  const recentTasks = tasks.filter(task => task.status === 'completed');

  const selectTask = (id: string) => {
    setActiveTask(id);
    navigate(`/tasks/${id}`);
  };

  const renderTask = (task: TaskRecord, recent = false) => (
    <button
      className={`sidebar-task${task.id === activeTaskId ? ' selected' : ''}${recent ? ' recent-task' : ''}`}
      key={task.id}
      onClick={() => selectTask(task.id)}
      type="button"
    >
      <span className="sidebar-task-title">
        <strong>{task.title}</strong>
      </span>
      <span className="sidebar-task-meta">
        <TaskStateIcon task={task} />
        <time>{task.time}</time>
      </span>
    </button>
  );

  return (
    <aside className="sidebar">
      <div className="brand">
        <WindowControls />
        <span className="brand-mark"><span /><span /></span>
        <button className="brand-name" onClick={() => navigate('/tasks/new')} type="button">
          Work Studio
        </button>
        <button className="icon-button search-button" aria-label="搜索" type="button"><Search /></button>
      </div>

      <nav className="primary-nav">
        {(['knowledge', 'plugins', 'skills'] as const).map(route => (
          <NavLink className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`} key={route} to={`/${route}`}>
            <NavIcon kind={route} />
            <span>{route === 'knowledge' ? '知识库' : route === 'plugins' ? '插件' : '技能'}</span>
          </NavLink>
        ))}
      </nav>

      <div className="task-module">
        <div className="module-label">
          <span>任务</span>
          <button className="new-task-entry" onClick={() => navigate('/tasks/new')} type="button">
            <Plus />
            <span>新建任务</span>
          </button>
        </div>
        <div className="task-module-scroll">
          {tasks.length === 0 ? (
            <div className="task-list-empty">
              <ListChecks />
              <strong>还没有任务</strong>
              <span className="task-empty-copy">创建任务并发送第一段描述后，会在这里持续跟踪。</span>
              <button className="empty-create-task" onClick={() => navigate('/tasks/new')} type="button">
                <Plus />
                <span>新建任务</span>
              </button>
            </div>
          ) : null}
          {activeTasks.length > 0 ? (
            <section className="task-cluster">
              <div className="cluster-title static"><Folder /><span>进行中</span></div>
              <div className="cluster-tasks">{activeTasks.map(task => renderTask(task))}</div>
            </section>
          ) : null}
          {waitingTasks.length > 0 ? (
            <section className="task-cluster waiting-cluster">
              <div className="cluster-title static"><Folder className="waiting-folder" /><span>待确认</span></div>
              <div className="cluster-tasks">{waitingTasks.map(task => renderTask(task))}</div>
            </section>
          ) : null}
          {recentTasks.length > 0 ? (
            <section className="recent-tasks">
              <div className="recent-label">最近任务</div>
              {recentTasks.map(task => renderTask(task, true))}
            </section>
          ) : null}
        </div>
      </div>

      <footer className="user-card">
        <span className="avatar">MX</span>
        <span><strong>mu xiaonong</strong></span>
        <button
          className={`sidebar-settings-button${location.pathname.startsWith('/settings') ? ' active' : ''}`}
          aria-label="打开设置"
          onClick={() => navigate('/settings/general')}
          type="button"
        >
          <Settings />
          <span>设置</span>
        </button>
      </footer>
    </aside>
  );
}
