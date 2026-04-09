export * from './layout';
export { default as AppLayout } from './layout/AppLayout';

export { default as Modal } from './components/Modal';
export { default as ConfirmationModal } from './components/ConfirmationModal';
export { default as ErrorModal } from './components/ErrorModal';
export { default as ErrorMessage } from './components/ErrorMessage';
export { default as ErrorPage } from './components/ErrorPage';
export { default as LoadingOverlay } from './components/LoadingOverlay';
export { default as Spinner } from './components/Spinner';
export { default as UploadProgress } from './components/UploadProgress';
export { default as ImageWithFallback } from './components/ImageWithFallback';
export { default as NotificationBell } from './components/NotificationBell';
export { default as NotificationItem } from './components/NotificationItem';
export { default as TourOverlay } from './components/TourOverlay';

export { AuthProvider, useAuth } from './context/AuthContext';
export {
  NotificationProvider,
  useNotification,
  useConfirmation,
} from './context/NotificationContext';
export { TourProvider, useTour } from './context/TourContext';

export * from './services/apiService';
export * from './services/authRefresh';
export { notificationService } from './services/notificationService';
export { performanceService } from './services/performanceService';

export * from './utils/tourSteps';
export * from './utils/imageProcessing';

// Shell formal: componentes de metricas con ubicacion transitoria fuera de src/shell.
export {
  MetricCard,
  StatsCard,
  ProjectDashboard,
} from '../components/dashboard';
