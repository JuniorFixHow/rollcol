/** What a move will do: problems first (they stop the move), then what moves, then each change. */
export function MovePreview({ items }: { items: { severity: string; message: string }[] }) {
  const blockers = items.filter((item) => item.severity === "blocker");
  const info = items.filter((item) => item.severity === "info");
  const changes = items.filter((item) => item.severity === "change");
  return (
    <div className="space-y-4 text-sm">
      {blockers.length > 0 ? (
        <div className="rounded-md border border-danger/40 bg-danger-soft p-4">
          <p className="font-medium text-danger">Before the move can happen</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {blockers.map((item) => (
              <li key={item.message}>{item.message}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {info.length > 0 ? (
        <ul className="space-y-1">
          {info.map((item) => (
            <li key={item.message}>{item.message}</li>
          ))}
        </ul>
      ) : null}
      {changes.length > 0 ? (
        <div>
          <p className="font-medium">Changes along the way</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            {changes.map((item) => (
              <li key={item.message}>{item.message}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-muted">Nothing clashes with the school&apos;s records.</p>
      )}
    </div>
  );
}
