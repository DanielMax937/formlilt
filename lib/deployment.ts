/** Public preview has no model credentials and accepts only checked-in demo schemas. */
export const isDemoOnly = () => process.env.NEXT_PUBLIC_DEMO_ONLY === 'true';
export function assertRequestFits(data: FormData) {
  const limit = Number(process.env.NEXT_PUBLIC_MAX_REQUEST_BYTES || 18_000_000);
  const estimatedBytes = [...data.values()].reduce(
    (n, value) =>
      n + (typeof value === 'string' ? new TextEncoder().encode(value).length : value.size) + 1024,
    0,
  );
  return estimatedBytes <= limit;
}
