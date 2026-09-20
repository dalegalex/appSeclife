import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Capacitor } from '@capacitor/core';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Tutorial {
  id: number; titulo: string; descripcion: string; categoria: string;
  versionApp: string; duracion: number; bytes: number; ancho: number; alto: number;
}
export interface PlaybackLink { url: string; expiresAt: string; }
interface Envelope<T> { result: T; codeNumber: number; message: string; }

@Injectable({ providedIn: 'root' })
export class TutorialesService {
  private readonly http = inject(HttpClient);
  private readonly base = `${Capacitor.isNativePlatform() ? environment.androidApiUrl : environment.apiUrl}/tutoriales`;
  list(topi: number, buscar: string, categoria: string) {
    const params = new HttpParams().set('topi', topi).set('buscar', buscar.trim()).set('categoria', categoria);
    return this.http.get<Envelope<Tutorial[]>>(this.base, { params }).pipe(map(r => this.result(r) ?? []));
  }
  playback(id: number) {
    return this.http.post<Envelope<PlaybackLink>>(`${this.base}/${id}/reproduccion`, {}).pipe(map(r => this.result(r)));
  }
  private result<T>(response: Envelope<T>): T {
    if (response.codeNumber !== 200) throw new Error(response.message || 'No fue posible consultar el material.');
    return response.result;
  }
}
