import { useNavigate } from 'react-router';
import { Leaf } from 'lucide-react';

export function NotFound() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <Leaf className="w-16 h-16 text-[#2E7D32] mb-6 opacity-40" />
      <h1 className="text-5xl font-bold mb-4">404</h1>
      <p className="text-xl text-muted-foreground mb-8">This page doesn't exist</p>
      <button onClick={() => navigate('/')} className="bg-[#2E7D32] text-white px-8 py-3 rounded-xl font-semibold hover:bg-[#1B5E20] transition-all">
        Back to Dashboard
      </button>
    </div>
  );
}
