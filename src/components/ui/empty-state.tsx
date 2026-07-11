import { Inbox } from "lucide-react";

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="flex min-h-52 flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-[var(--line)] bg-[var(--surface)] p-8 text-center">
    <span className="mb-4 rounded-2xl bg-[var(--surface-2)] p-3 text-[var(--muted)]"><Inbox /></span>
    <h3 className="font-black">{title}</h3>
    <p className="mt-2 max-w-md text-sm leading-7 text-[var(--muted)]">{description}</p>
  </div>;
}
