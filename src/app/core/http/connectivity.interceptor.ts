import { Injectable } from '@angular/core';
import { HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { normalizeConnectivityError } from './connectivity-error';

@Injectable()
export class ConnectivityInterceptor implements HttpInterceptor {
  intercept(request: HttpRequest<unknown>, next: HttpHandler) {
    return next.handle(request).pipe(
      catchError(error => throwError(() => normalizeConnectivityError(error)))
    );
  }
}
