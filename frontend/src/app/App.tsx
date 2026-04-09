import { RouterProvider } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { router } from './routes';
import { AuthProvider } from '../contexts/AuthContext';
import { LocationProvider } from '../contexts/LocationContext';
import { queryClient } from '../lib/queryClient';

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <LocationProvider>
          <RouterProvider router={router} />
          <Toaster position="bottom-right" richColors closeButton />
        </LocationProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
