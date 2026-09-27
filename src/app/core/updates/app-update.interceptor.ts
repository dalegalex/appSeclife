import { Injectable } from '@angular/core';
import { HttpErrorResponse, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { catchError, defer, finalize, from, switchMap, throwError } from 'rxjs';
import { AppUpdateService } from './app-update.service';

@Injectable()
export class AppUpdateInterceptor implements HttpInterceptor {
  constructor(private readonly updates: AppUpdateService) {}
  intercept(request: HttpRequest<unknown>, next: HttpHandler) {
    if (!request.url.startsWith(`${this.updates.base}/`)) return next.handle(request);
    return defer(() => {
      if (this.updates.blocked() && !request.url.includes('/app-version/')) {
        return throwError(() => new HttpErrorResponse({ status: 426,
          error: { code: 'APP_UPDATE_REQUIRED', message: 'Actualiza Seclife desde la tienda para continuar.' } }));
      }
      this.updates.beginRequest();
      return from(this.updates.headers()).pipe(
        switchMap(headers => next.handle(request.clone({ setHeaders: headers }))),
        catchError(error => { this.updates.handleRequired(error); return throwError(() => error); }),
        finalize(() => this.updates.endRequest())
      );
    });
  }
}
