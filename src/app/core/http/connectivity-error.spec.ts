import { HttpErrorResponse } from '@angular/common/http';
import { CONNECTIVITY_MESSAGE, normalizeConnectivityError } from './connectivity-error';

describe('Connectivity error', () => {
  for (const status of [0, 502, 503, 504]) {
    it('sanitizes unavailable service ' + status, () => {
      const input = new HttpErrorResponse({status, url: 'https://private.example/api/login',
        error: '<html>upstream https://private.example unavailable</html>'});
      const result = normalizeConnectivityError(input) as HttpErrorResponse;
      expect(result instanceof HttpErrorResponse).toBeTrue();
      expect(result.status).toBe(status);
      expect(result.message).toBe(CONNECTIVITY_MESSAGE);
      expect(result.error.message).toBe(CONNECTIVITY_MESSAGE);
      expect(result.url).toBeNull();
      expect(JSON.stringify(result)).not.toContain('private.example');
    });
  }
  for (const status of [400, 401, 403, 404, 409, 422, 500]) {
    it('preserves functional error ' + status, () => {
      const input = new HttpErrorResponse({status, error: {message: 'Mensaje funcional'}});
      expect(normalizeConnectivityError(input)).toBe(input);
    });
  }
});
