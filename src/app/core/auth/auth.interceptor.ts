import { Injectable } from '@angular/core';
import {
  HttpErrorResponse,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';
import { SessionLockStateService } from './session-lock-state.service';

@Injectable()
export class AuthInterceptor implements HttpInterceptor {
  constructor(
    private readonly authService: AuthService,
    private readonly lockState: SessionLockStateService
  ) {}

  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    const token = this.authService.getToken();

    const authorizedRequest = token ? request.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    }) : request;

    return next.handle(authorizedRequest).pipe(
      catchError((error: unknown) => {
        if (error instanceof HttpErrorResponse) {
          if (error.status === 0) {
            return throwError(() => this.withUserMessage(
              error,
              'No fue posible conectar con Seclife. Revisa tu conexion WiFi o datos moviles e intenta nuevamente.'
            ));
          }

          if (error.status === 403 && this.authService.isSupportSession()) {
            return throwError(() => this.withUserMessage(
              error,
              'El acceso de soporte es exclusivamente de consulta. No se permite guardar ni modificar informacion del familiar.'
            ));
          }

          if (error.status === 401 && !this.isAuthenticationRequest(request.url)) {
            if (this.authService.session()) {
              this.lockState.requestLock('UNAUTHORIZED');
            }
            return throwError(() => this.withUserMessage(
              error,
              'La sesion vencio. Inicia sesion nuevamente para continuar.'
            ));
          }
        }
        return throwError(() => error);
      })
    );
  }

  private withUserMessage(error: HttpErrorResponse, message: string): HttpErrorResponse {
    const responseBody = typeof error.error === 'object' && error.error !== null
      ? { ...error.error, message }
      : { message };

    return new HttpErrorResponse({
      error: responseBody,
      headers: error.headers,
      status: error.status,
      statusText: error.statusText,
      url: error.url ?? undefined,
    });
  }

  private isAuthenticationRequest(url: string): boolean {
    return url.includes('/auth/google')
      || url.includes('/auth/local/')
      || url.includes('/auth/registro-codigo')
      || url.includes('/auth/biometria/ingresar');
  }
}
