const TRANSPORTE_TIME_ZONE = 'America/Mexico_City';

export type TransporteDiaSemanaField = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';

interface MexicoDateParts {
  year: string;
  month: string;
  day: string;
  hour: string;
  minute: string;
  second: string;
}

function mexicoParts(value = new Date()): MexicoDateParts {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: TRANSPORTE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const parts = formatter.formatToParts(value);
  const resolve = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '00';

  return {
    year: resolve('year'),
    month: resolve('month'),
    day: resolve('day'),
    hour: resolve('hour'),
    minute: resolve('minute'),
    second: resolve('second'),
  };
}

export function todayMexicoSql(value = new Date()): string {
  const parts = mexicoParts(value);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function resolveDiaSemanaMexico(fecha: string): TransporteDiaSemanaField {
  const [year, month, day] = fecha.split('-').map((value) => Number(value));
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();

  switch (weekday) {
    case 0:
      return 'domingo';
    case 1:
      return 'lunes';
    case 2:
      return 'martes';
    case 3:
      return 'miercoles';
    case 4:
      return 'jueves';
    case 5:
      return 'viernes';
    case 6:
    default:
      return 'sabado';
  }
}

export function nowMexicoSql(value = new Date()): string {
  const parts = mexicoParts(value);
  const milliseconds = String(value.getMilliseconds()).padStart(3, '0');

  return `${parts.year}-${parts.month}-${parts.day}` +
    `T${parts.hour}:${parts.minute}:${parts.second}.${milliseconds}`;
}

export function formatMexicoTime(value?: Date | string | null): string {
  if (!value) {
    return 'Sin registro';
  }

  const textValue = typeof value === 'string' ? value : '';
  const match = textValue.match(/^\d{4}-\d{2}-\d{2}[T\s](\d{2}):(\d{2})(?::(\d{2}))?/);
  if (match) {
    return formatClockAmPm(Number(match[1]), Number(match[2]), match[3] ? Number(match[3]) : undefined);
  }

  return new Date(value).toLocaleTimeString('es-MX', {
    timeZone: TRANSPORTE_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

export function formatClockAmPm(hours: number, minutes: number, seconds?: number): string {
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return '--:--';
  }

  const suffix = hours >= 12 ? 'p. m.' : 'a. m.';
  const normalizedHour = hours % 12 || 12;
  const base = `${String(normalizedHour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  const withSeconds = seconds === undefined ? base : `${base}:${String(seconds).padStart(2, '0')}`;
  return `${withSeconds} ${suffix}`;
}

export function currentMexicoMinutes(): number {
  const parts = mexicoParts();
  return Number(parts.hour) * 60 + Number(parts.minute);
}
