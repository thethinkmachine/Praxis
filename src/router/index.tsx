import React, { Suspense } from 'react';
import { createBrowserRouter, RouterProvider, Navigate } from 'react-router-dom';
import AppShell from '@/components/layout/AppShell';

const HomePage = React.lazy(() => import('@/pages/HomePage'));
const SearchPage = React.lazy(() => import('@/pages/SearchPage'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-full">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <span className="text-text-secondary text-sm">Loading module...</span>
    </div>
  </div>
);

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      {
        index: true,
        element: (
          <Suspense fallback={<PageLoader />}>
            <HomePage />
          </Suspense>
        ),
      },
      {
        path: 'search/:category/:algo',
        element: (
          <Suspense fallback={<PageLoader />}>
            <SearchPage />
          </Suspense>
        ),
      },
      {
        path: '*',
        element: <Navigate to="/" replace />,
      },
    ],
  },
]);

export default function Router() {
  return <RouterProvider router={router} />;
}
