export interface Turno {
  id: string;
  zona: string;
  horario: string;
  plazas: number;
}

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  turnos?: T;
  message?: string;
}

export class ApiService {
  public static readonly API_URL = 'TU_URL_DE_API_AQUI';

  private constructor() {}

  public static async obtenerTurnos(zona: string): Promise<Turno[]> {
    const params = new URLSearchParams({
      action: 'obtenerTurnos',
      zona
    });

    const response = await fetch(`${ApiService.API_URL}?${params.toString()}`, {
      method: 'GET'
    });

    const json = await ApiService.parseJson<ApiResponse<Turno[]>>(response);

    if (!response.ok || json.success !== true) {
      throw new Error(json.message ?? `Error HTTP ${response.status}`);
    }

    return json.turnos ?? json.data ?? [];
  }

  public static async inscribirse(
    idTurno: string,
    nombre: string,
    apellidos: string
  ): Promise<void> {
    const response = await fetch(ApiService.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        action: 'inscribirse',
        idTurno,
        nombre,
        apellidos
      })
    });

    const json = await ApiService.parseJson<ApiResponse<never>>(response);

    if (!response.ok || json.success !== true) {
      throw new Error(json.message ?? `Error HTTP ${response.status}`);
    }
  }

  private static async parseJson<T>(response: Response): Promise<T> {
    const rawBody = await response.text();

    try {
      return JSON.parse(rawBody) as T;
    } catch (error) {
      console.error('Respuesta JSON invalida del servidor', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        contentType: response.headers.get('content-type'),
        bodyPreview: rawBody.slice(0, 500),
        error
      });

      throw new Error('Respuesta JSON invalida del servidor');
    }
  }
}
