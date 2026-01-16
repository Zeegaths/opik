import { useEffect, useState } from 'react';

interface ClientOnlyProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

const DefaultFallback = () => (
  <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white flex items-center justify-center">
    <div className="text-center">
      <div className="relative inline-block mb-6">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-orange-500/20 blur-2xl animate-pulse"></div>
        <div className="relative text-6xl">⚡</div>
      </div>
      <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-orange-400 bg-clip-text text-transparent">
        Loading Builder Uptime...
      </h2>
      <p className="text-gray-500 text-sm mt-2">Initializing your workspace</p>
    </div>
  </div>
);

export function ClientOnly({ children, fallback }: ClientOnlyProps) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return <>{fallback || <DefaultFallback />}</>;
  }

  return <>{children}</>;
}

export default ClientOnly;