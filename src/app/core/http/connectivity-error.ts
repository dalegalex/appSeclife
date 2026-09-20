import { HttpErrorResponse } from '@angular/common/http';

export const CONNECTIVITY_MESSAGE = 'Problema de conectividad, intente mas tarde';

export function isConnectivityError(error: unknown): error is HttpErrorResponse {
  return error instanceof HttpErrorResponse && [0, 502, 503, 504].includes(error.status);
}

export function normalizeConnectivityError(error: unknown): unknown {
  if (!isConnectivityError(error)) return error;
  const safe = new HttpErrorResponse({
    status: error.status,
    statusText: error.statusText,
    headers: error.headers,
    error: { message: CONNECTIVITY_MESSAGE, detail: CONNECTIVITY_MESSAGE, title: CONNECTIVITY_MESSAGE },
  });
  // HttpErrorResponse generates a technical message even without a URL.
  Object.defineProperty(safe, 'message', { value: CONNECTIVITY_MESSAGE });
  return safe;
}
