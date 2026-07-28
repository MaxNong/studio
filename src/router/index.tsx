import { useRoutes } from 'react-router-dom';
import { appRoutes } from './routes';

export function AppRouter() {
  return useRoutes(appRoutes);
}
