export function NotFoundState({ label = "Not found" }: { label?: string }) {
  return (
    <div className="rounded-lg border border-line py-14 text-center text-sm text-ink-soft">
      {label}. It may have been moved or removed.
    </div>
  );
}
