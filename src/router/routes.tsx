import { Navigate, type RouteObject } from 'react-router-dom';
import { KnowledgePage } from '../pages/knowledge';
import { NewTaskPage } from '../pages/new-task';
import { PluginsPage } from '../pages/plugins';
import { SettingsPage } from '../pages/settings';
import { SkillsPage } from '../pages/skills';
import { TaskPage } from '../pages/task-detail';

export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <Navigate replace to="/tasks/new" />,
  },
  {
    path: '/tasks/new',
    element: <NewTaskPage />,
  },
  {
    path: '/tasks/:taskId',
    element: <TaskPage />,
  },
  {
    path: '/knowledge',
    element: <KnowledgePage />,
  },
  {
    path: '/plugins',
    element: <PluginsPage />,
  },
  {
    path: '/skills',
    element: <SkillsPage />,
  },
  {
    path: '/settings/:panel',
    element: <SettingsPage />,
  },
  {
    path: '/settings',
    element: <Navigate replace to="/settings/general" />,
  },
  {
    path: '*',
    element: <Navigate replace to="/tasks/new" />,
  },
];
