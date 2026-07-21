import { Injectable, NgZone } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { HubConnection, HubConnectionBuilder, HubConnectionState, LogLevel } from '@microsoft/signalr';
import { Observable, Subject, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { AuthService } from '../../../core/auth/auth.service';
import {
  AbrirCarruselRequest,
  AsociarPuntoCarruselRequest,
  CancelarAlumnoCarruselRequest,
  CarruselDispositivo,
  CarruselPaquete,
  CarruselSesion,
  CerrarCarruselRequest,
  ConfirmarEntregaCarruselRequest,
  DesconectarPuntoCarruselRequest,
  RegistrarPuntoCarruselRequest,
  RegistrarAvisoCarruselRequest,
  SpResponse,
} from '../models/carrusel.model';

@Injectable({ providedIn: 'root' })
export class CarruselService {
  private readonly apiUrl = Capacitor.isNativePlatform()
    ? environment.androidApiUrl
    : environment.apiUrl;
  private readonly baseUrl = `${this.apiUrl}/control-accesos/carrusel`;
  private readonly hubUrl = `${this.apiUrl.replace(/\/api\/?$/, '')}/carruselHub`;

  private connection: HubConnection | null = null;
  private joinedIdorg: number | null = null;
  private joinedCarruselId: number | null = null;
  private readonly avisoSubject = new Subject<CarruselPaquete | unknown>();
  private readonly entregaSubject = new Subject<unknown>();
  private readonly puntoSubject = new Subject<CarruselDispositivo | unknown>();
  private readonly puntoDesconectadoSubject = new Subject<CarruselDispositivo | unknown>();
  private readonly cierreSubject = new Subject<CarruselSesion | unknown>();

  readonly aviso$ = this.avisoSubject.asObservable();
  readonly entrega$ = this.entregaSubject.asObservable();
  readonly punto$ = this.puntoSubject.asObservable();
  readonly puntoDesconectado$ = this.puntoDesconectadoSubject.asObservable();
  readonly cierre$ = this.cierreSubject.asObservable();

  constructor(
    private readonly http: HttpClient,
    private readonly authService: AuthService,
    private readonly zone: NgZone
  ) {}

  abrirSesion(request: AbrirCarruselRequest): Observable<CarruselSesion> {
    return this.http.post<SpResponse<CarruselSesion>>(`${this.baseUrl}/sesiones`, request).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as CarruselSesion;
      })
    );
  }

  listarSesiones(idorg: number): Observable<CarruselSesion[]> {
    const params = new HttpParams().set('idorg', String(idorg));
    return this.http.get<SpResponse<CarruselSesion[]>>(`${this.baseUrl}/sesiones`, { params }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result ?? [];
      })
    );
  }

  registrarAviso(idcarruselsesion: number, request: RegistrarAvisoCarruselRequest): Observable<CarruselPaquete> {
    return this.http.post<SpResponse<CarruselPaquete>>(`${this.baseUrl}/sesiones/${idcarruselsesion}/avisos`, request).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as CarruselPaquete;
      })
    );
  }

  registrarPunto(request: RegistrarPuntoCarruselRequest): Observable<CarruselDispositivo> {
    return this.http.post<SpResponse<CarruselDispositivo>>(`${this.baseUrl}/puntos`, request).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as CarruselDispositivo;
      })
    );
  }

  asociarPunto(
    idcarruselsesion: number,
    idcarruseldispositivo: number,
    request: AsociarPuntoCarruselRequest
  ): Observable<CarruselDispositivo> {
    return this.http
      .put<SpResponse<CarruselDispositivo>>(`${this.baseUrl}/sesiones/${idcarruselsesion}/puntos/${idcarruseldispositivo}`, request)
      .pipe(
        map((response) => {
          this.assertSuccess(response);
          return response.result as CarruselDispositivo;
        })
      );
  }

  desconectarPunto(idcarruseldispositivo: number, request: DesconectarPuntoCarruselRequest): Observable<CarruselDispositivo> {
    return this.http
      .put<SpResponse<CarruselDispositivo>>(`${this.baseUrl}/puntos/${idcarruseldispositivo}/desconectar`, request)
      .pipe(
        map((response) => {
          this.assertSuccess(response);
          return response.result as CarruselDispositivo;
        })
      );
  }

  consultarCola(idcarruselsesion: number, idorg?: number | null): Observable<CarruselPaquete[]> {
    let params = new HttpParams();
    if (idorg) {
      params = params.set('idorg', String(idorg));
    }

    return this.http.get<SpResponse<CarruselPaquete[]>>(`${this.baseUrl}/sesiones/${idcarruselsesion}/cola`, { params }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result ?? [];
      })
    );
  }

  consultarBitacora(idcarruselsesion: number, idorg?: number | null): Observable<CarruselPaquete[]> {
    let params = new HttpParams();
    if (idorg) {
      params = params.set('idorg', String(idorg));
    }

    return this.http.get<SpResponse<CarruselPaquete[]>>(`${this.baseUrl}/sesiones/${idcarruselsesion}/bitacora`, { params }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result ?? [];
      })
    );
  }

  consultarFotoAlumno(idmatricula: number, idorg?: number | null): Observable<{ idmatricula: number; foto?: string | null }> {
    let params = new HttpParams();
    if (idorg) {
      params = params.set('idorg', String(idorg));
    }

    return this.http.get<SpResponse<{ idmatricula: number; foto?: string | null }>>(`${this.apiUrl}/control-accesos/alumnos/${idmatricula}/foto`, { params }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result ?? { idmatricula, foto: null };
      })
    );
  }

  confirmarEntrega(idcarrusellectura: number, request: ConfirmarEntregaCarruselRequest): Observable<unknown> {
    return this.http.post<SpResponse<unknown>>(`${this.baseUrl}/avisos/${idcarrusellectura}/entrega`, request).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result;
      })
    );
  }

  cancelarAlumno(idcarruselentregaalumno: number, request: CancelarAlumnoCarruselRequest): Observable<unknown> {
    return this.http.put<SpResponse<unknown>>(`${this.baseUrl}/alumnos/${idcarruselentregaalumno}/cancelar`, request).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result;
      })
    );
  }

  cerrarSesion(idcarruselsesion: number, request: CerrarCarruselRequest): Observable<CarruselSesion> {
    return this.http.delete<SpResponse<CarruselSesion>>(`${this.baseUrl}/sesiones/${idcarruselsesion}`, { body: request }).pipe(
      map((response) => {
        this.assertSuccess(response);
        return response.result as CarruselSesion;
      })
    );
  }

  async conectar(idorg: number, idcarruselsesion?: number | null): Promise<void> {
    if (!this.connection) {
      this.connection = new HubConnectionBuilder()
        .withUrl(this.hubUrl, {
          accessTokenFactory: () => this.authService.getToken() ?? '',
        })
        .withAutomaticReconnect()
        .configureLogging(LogLevel.Warning)
        .build();

      this.connection.on('avisoCarruselRegistrado', (payload) => this.zone.run(() => this.avisoSubject.next(payload)));
      this.connection.on('entregaCarruselActualizada', (payload) => this.zone.run(() => this.entregaSubject.next(payload)));
      this.connection.on('alumnoCarruselCancelado', (payload) => this.zone.run(() => this.entregaSubject.next(payload)));
      this.connection.on('puntoCarruselDisponible', (payload) => this.zone.run(() => this.puntoSubject.next(payload)));
      this.connection.on('puntoCarruselAsociado', (payload) => this.zone.run(() => this.puntoSubject.next(payload)));
      this.connection.on('puntoCarruselDesconectado', (payload) => this.zone.run(() => this.puntoDesconectadoSubject.next(payload)));
      this.connection.on('carruselCerrado', (payload) => this.zone.run(() => this.cierreSubject.next(payload)));
      this.connection.onreconnected(() => {
        void this.rejoinGroups();
      });
    }

    this.joinedIdorg = idorg;
    this.joinedCarruselId = idcarruselsesion ?? this.joinedCarruselId;

    if (this.connection.state === HubConnectionState.Disconnected) {
      await this.connection.start();
    }

    await this.rejoinGroups();
  }

  async desconectar(): Promise<void> {
    if (!this.connection) {
      return;
    }

    await this.connection.stop();
    this.connection = null;
    this.joinedIdorg = null;
    this.joinedCarruselId = null;
  }

  private async rejoinGroups(): Promise<void> {
    if (!this.connection || this.connection.state !== HubConnectionState.Connected || !this.joinedIdorg) {
      return;
    }

    await this.connection.invoke('UnirseOrganizacion', this.joinedIdorg);
    if (this.joinedCarruselId) {
      await this.connection.invoke('UnirseCarrusel', this.joinedCarruselId);
    }
  }

  private assertSuccess<T>(response: SpResponse<T>): void {
    if (response.codeNumber && response.codeNumber !== 200) {
      throw new Error(response.message || 'No fue posible completar la operacion.');
    }
  }
}
