import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import type { AppHealth } from './shared/contracts';
import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { Composer } from './components/tasks/Composer';
import { TaskInspector } from './components/tasks/TaskInspector';
import { AppRouter } from './router';
import { useWorkspaceStore } from './store';

const routeTitle: Record<string, string> = {
  '/knowledge': '知识库',
  '/plugins': '插件',
  '/skills': '技能',
};

export function App() {
  const location = useLocation();
  const isTask = location.pathname.startsWith('/tasks');
  const isNewTask = location.pathname === '/tasks/new';
  const isSettings = location.pathname.startsWith('/settings');
  const { inspectorCollapsed, tasks, applyAgentEvent } = useWorkspaceStore();
  const [health, setHealth] = useState<AppHealth | null>(null);

  useEffect(() => {
    const refreshHealth = () => {
      void window.workStudio.getHealth().then(setHealth);
    };
    refreshHealth();
    window.addEventListener('work-studio:settings-changed', refreshHealth);
    return () => window.removeEventListener('work-studio:settings-changed', refreshHealth);
  }, []);

  useEffect(() => window.workStudio.agent.onEvent(applyAgentEvent), [applyAgentEvent]);

  const routeTaskId = isTask && !isNewTask ? location.pathname.split('/').at(-1) : null;
  const activeTask = routeTaskId ? tasks.find(task => task.id === routeTaskId) : undefined;
  const title = isNewTask
    ? '新建任务'
    : activeTask?.title ?? (isSettings ? '设置' : routeTitle[location.pathname]) ?? 'Work Studio';
  const appShellClass = [
    'app-shell',
    !isTask ? 'knowledge-route' : '',
    isNewTask ? 'new-task-route' : '',
    inspectorCollapsed ? 'inspector-collapsed' : '',
  ].filter(Boolean).join(' ');

  return (
    <>
      <div className={appShellClass}>
        <Sidebar />
        <main className="workspace">
          <Topbar title={title} taskRoute={isTask} task={activeTask} />
          <AppRouter />
        </main>
        {isTask && !isNewTask && activeTask ? <TaskInspector /> : null}
        {isTask ? <Composer health={health} newTask={isNewTask} task={activeTask} /> : null}
      </div>
    </>
  );
}
