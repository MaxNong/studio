import { Navigate, useParams } from 'react-router-dom';
import { TaskWorkspace } from '../../components/tasks/TaskWorkspace';
import { useWorkspaceStore } from '../../store';

export function TaskPage() {
  const { taskId } = useParams();
  const task = useWorkspaceStore(state => state.tasks.find(item => item.id === taskId));

  return task
    ? <TaskWorkspace task={task} />
    : <Navigate replace to="/tasks/new" />;
}
