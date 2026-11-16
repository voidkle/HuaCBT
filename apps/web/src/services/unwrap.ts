interface EdenResult {
  data: unknown;
  error: { status?: unknown; value: unknown } | null;
}

/** An API failure that keeps its HTTP status (e.g. 409 "time is up") so callers can react to it. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
  ) {
    super(message);
  }
}

/** Eden returns `{ data, error }`; turn failures into an ApiError carrying the API's message and status. */
export function unwrap<T>({ data, error }: EdenResult): T {
  if (error || data == null) {
    const message = (error?.value as { message?: string } | undefined)?.message;
    throw new ApiError(message ?? "Permintaan gagal", typeof error?.status === "number" ? error.status : null);
  }
  return data as T;
}
