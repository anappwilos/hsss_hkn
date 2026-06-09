import type { OutboxEvent, PersonaCache } from '../core/models';
import { DatabaseHelper } from './db_helper';

export class TurnoRepository {
  private readonly db: DatabaseHelper;

  public constructor(db: DatabaseHelper = new DatabaseHelper()) {
    this.db = db;
  }

  public async guardarLotePersonas(personas: PersonaCache[]): Promise<void> {
    const database = await this.db.init();

    return new Promise((resolve, reject) => {
      const tx = database.transaction('personas', 'readwrite');
      const store = tx.objectStore('personas');

      for (const persona of personas) {
        store.put(persona);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  public async obtenerPorZona(zonaRequerida: string): Promise<PersonaCache[]> {
    const todas = await this.db.getAll<PersonaCache>('personas');
    return todas.filter((persona) => persona.zona === zonaRequerida);
  }

  public async marcarAsistenciaOffline(idPersona: string, estado: boolean): Promise<void> {
    const database = await this.db.init();
    const timestamp = Date.now();

    return new Promise((resolve, reject) => {
      const tx = database.transaction(['personas', 'outbox'], 'readwrite');
      const storePersonas = tx.objectStore('personas');
      const storeOutbox = tx.objectStore('outbox');
      const request = storePersonas.get(idPersona);
      let rechazoControlado = false;

      request.onsuccess = () => {
        const persona = request.result as PersonaCache | undefined;

        if (!persona) {
          rechazoControlado = true;
          tx.abort();
          reject(new Error(`Persona no encontrada: ${idPersona}`));
          return;
        }

        const personaActualizada: PersonaCache = {
          ...persona,
          asistencia: estado,
          ultimaModificacion: timestamp
        };

        const evento: OutboxEvent = {
          idEvento: crypto.randomUUID(),
          idPersona,
          nuevoEstado: estado,
          timestamp,
          intentos: 0
        };

        storePersonas.put(personaActualizada);
        storeOutbox.put(evento);
      };

      request.onerror = () => reject(request.error);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => {
        if (!rechazoControlado) {
          reject(tx.error);
        }
      };
    });
  }
}
