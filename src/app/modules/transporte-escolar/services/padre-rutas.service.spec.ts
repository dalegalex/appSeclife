import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../../core/auth/auth.service';
import { PadreRutaAlumno } from '../models/padre-ruta.model';
import { PadreRutasService } from './padre-rutas.service';

describe('Transporte Familiar: orden de alumnos', () => {
  const service = new PadreRutasService({} as HttpClient, {} as AuthService);
  const row = (id: number, alumno: string, estado?: string) => ({
    idmatricula: id, alumno,
    recorrido: estado ? { estatus: estado } : null,
  } as PadreRutaAlumno);

  it('ordena por el nombre completo recibido con apellidos primero sin mutar la entrada', () => {
    const input = [row(2, 'Zamora Ruiz Ana'), row(1, 'Alvarez Perez Zoe')];
    const result = service['priorizarRutasEnCurso'](input);
    expect(result.map(a => a.idmatricula)).toEqual([1, 2]);
    expect(input[0].idmatricula).toBe(2);
  });

  it('conserva la prioridad de recorrido activo dentro de cada alumno', () => {
    const activo = row(2, 'Zamora Ruiz Ana', 'EN_CURSO');
    const result = service['priorizarRutasEnCurso']([
      row(2, 'Zamora Ruiz Ana'), activo, row(1, 'Alvarez Zoe'),
    ]);
    expect(result).toEqual([jasmine.objectContaining({ idmatricula: 1 }), activo]);
  });

  it('desempata homonimos por matricula y admite lista vacia', () => {
    expect(service['priorizarRutasEnCurso']([row(2, 'Perez Ana'), row(1, 'Perez Ana')])
      .map(a => a.idmatricula)).toEqual([1, 2]);
    expect(service['priorizarRutasEnCurso']([])).toEqual([]);
  });
});
