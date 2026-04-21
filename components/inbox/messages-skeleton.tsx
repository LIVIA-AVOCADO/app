import { Skeleton } from '@/components/ui/skeleton';

// Cada linha do skeleton entra com delay escalonado para dar sensação de carregamento progressivo
const rows = [
  { side: 'left',  bubbleH: 'h-16', bubbleW: 'w-64', delay: 'delay-0' },
  { side: 'right', bubbleH: 'h-12', bubbleW: 'w-48', delay: 'delay-75' },
  { side: 'left',  bubbleH: 'h-20', bubbleW: 'w-72', delay: 'delay-150' },
  { side: 'right', bubbleH: 'h-14', bubbleW: 'w-56', delay: 'delay-200' },
  { side: 'left',  bubbleH: 'h-12', bubbleW: 'w-60', delay: 'delay-300' },
  { side: 'right', bubbleH: 'h-16', bubbleW: 'w-52', delay: 'delay-[375ms]' },
] as const;

export function MessagesSkeleton() {
  return (
    <div className="scrollbar-themed h-full overflow-y-auto p-4 space-y-4">
      {rows.map((row, i) => (
        <div
          key={i}
          className={`flex ${row.side === 'right' ? 'justify-end' : 'justify-start'} animate-in fade-in-0 duration-300 ${row.delay}`}
        >
          <div className="max-w-[70%] space-y-2">
            <Skeleton className={`h-4 ${row.side === 'right' ? 'w-20 ml-auto' : 'w-24'}`} />
            <Skeleton className={`${row.bubbleH} ${row.bubbleW} rounded-2xl`} />
          </div>
        </div>
      ))}
    </div>
  );
}
