'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { MessageSquare, RefreshCw } from 'lucide-react';

export default function LivechatError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[livechat] page error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4">
      <div className="w-16 h-16 rounded-2xl icon-gradient-brand flex items-center justify-center shadow-md">
        <MessageSquare className="h-8 w-8 text-white" />
      </div>
      <div className="text-center space-y-1.5">
        <h2 className="text-xl font-semibold">Erro ao carregar o livechat</h2>
        <p className="text-sm text-muted-foreground">
          Ocorreu um problema ao buscar as conversas. Tente novamente.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground/60 font-mono">
            digest: {error.digest}
          </p>
        )}
      </div>
      <Button onClick={reset} variant="outline" className="gap-2">
        <RefreshCw className="h-4 w-4" />
        Tentar novamente
      </Button>
    </div>
  );
}
