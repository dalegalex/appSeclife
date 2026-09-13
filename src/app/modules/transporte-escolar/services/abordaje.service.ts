import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { environment } from '../../../../environments/environment';

export interface AbordajePase { idrecorrido: number; fecha: string; estado: string; revision: number; }
export interface AbordajeAlumno {
  idrecorridoalumno: number; nombre: string; seleccionado: boolean; idevento?: number;
  correccion?: string; salidaRegistrada?: boolean; procesado: boolean; avisos: { total: number; enviados: number; fallidos: number };
}
export interface AbordajeEstado { idruta: number; fechaServidor: string; pase?: AbordajePase; alumnos: AbordajeAlumno[]; pendientes: AbordajePase[]; programados?: { idmatricula: number; nombre: string; salidaRegistrada?: boolean }[]; }
export interface AbordajeResponse<T> { result: T; message: string; codeNumber: number; }
@Injectable({ providedIn: 'root' })
export class AbordajeService {
  private readonly http = inject(HttpClient);
  private readonly url = (Capacitor.isNativePlatform() ? environment.androidApiUrl : environment.apiUrl) + '/transporte-escolar/abordaje';
  configuracion() { return this.http.get<AbordajeResponse<{ soloAbordajeSalida: boolean }>>(this.url + '/configuracion'); }
  consultar(idruta: number) { return this.http.get<AbordajeResponse<AbordajeEstado>>(this.url + '/rutas/' + idruta); }
  iniciar(idruta: number) { return this.http.post<AbordajeResponse<AbordajeEstado>>(this.url + '/rutas/' + idruta + '/iniciar', {}); }
  accion(id: number, accion: string, body: object = {}) {
    const url = this.url + '/pases/' + id + '/' + accion;
    return accion === 'seleccion'
      ? this.http.put<AbordajeResponse<AbordajeEstado>>(url, body)
      : this.http.post<AbordajeResponse<AbordajeEstado>>(url, body);
  }
}
