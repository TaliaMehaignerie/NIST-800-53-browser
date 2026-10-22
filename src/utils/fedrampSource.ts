/** Build-time wording for where the FedRAMP reference values came from (story 23). */
export function fedrampSourceText(fedramp: { baselines: Record<string, { capturedAt: string }> } | undefined): string {
  const dates = Object.values(fedramp?.baselines ?? {})
    .map((b) => b.capturedAt)
    .sort();
  if (dates.length === 0) return 'date unknown';
  return dates[0] === dates[dates.length - 1] ? `captured ${dates[0]}` : `captured ${dates[0]} to ${dates[dates.length - 1]}`;
}
