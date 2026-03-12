export function ReviewSection({
  icon, title, children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <div className="flex items-center gap-2 border-b border-zinc-100 bg-zinc-50 px-4 py-2.5 dark:border-zinc-800 dark:bg-zinc-900">
        <span className="text-zinc-500">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-400">
          {title}
        </span>
      </div>
      <div className="px-4 py-3">{children}</div>
    </div>
  );
}

export function ReviewRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-zinc-500 shrink-0">{label}</dt>
      <dd className="font-medium text-zinc-800 dark:text-zinc-200 text-right">{value}</dd>
    </div>
  );
}

export function EmptySection() {
  return <p className="text-xs text-zinc-400 italic">Não preenchido</p>;
}
