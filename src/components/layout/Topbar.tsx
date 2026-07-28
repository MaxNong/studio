import { CircleCheck, Folder, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { useWorkspaceStore, type TaskRecord } from '../../store';

interface TopbarProps {
  title: string;
  taskRoute: boolean;
  task?: TaskRecord;
}

export function Topbar({ title, taskRoute, task }: TopbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { completeTask, reopenTask } = useWorkspaceStore();
  const runActive = task?.runStatus === 'starting' || task?.runStatus === 'running';
  const completed = task?.status === 'completed';

  const changeTaskStatus = () => {
    if (!task) return;
    if (completed) reopenTask(task.id);
    else completeTask(task.id);
    setMenuOpen(false);
  };

  return (
    <header className="topbar">
      <div className="task-title">
        {taskRoute ? <Folder /> : <span className="route-dot" />}
        <span>{title}</span>
        {task ? (
          <div className="task-menu-wrap">
            <button
              className="more-button"
              aria-expanded={menuOpen}
              aria-label="任务操作"
              onClick={() => setMenuOpen(value => !value)}
              type="button"
            >
              ···
            </button>
            {menuOpen ? (
              <div className="task-actions-menu">
                <button disabled={runActive} onClick={changeTaskStatus} type="button">
                  {completed ? <RotateCcw /> : <CircleCheck />}
                  <span>{completed ? '重新打开任务' : '结束任务'}</span>
                </button>
                {runActive ? <small>请先等待本轮对话结束或停止执行</small> : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </header>
  );
}
