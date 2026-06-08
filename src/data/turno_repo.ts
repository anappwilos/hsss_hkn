import { PersonaCache, OutboxEvent } from '../core/models';
import { DatabaseHelper } from './db_helper';

export class TurnoRepository {
  private db = new DatabaseHelper();

  // Guarda masivamente lo que venga del Google Sheet
  public async guardarLotePersonas(personas: PersonaCache[]): Promise<void> {
    const database = await this.db.init();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('personas', 'readwrite');
      const store = tx.objectStore('personas');
      personas.forEach(p => store.put(p));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  // Filtra por zona (ideal para no renderizar 2M de personas de golpe)
  public async obtenerPorZona(zonaRequerida: string): Promise<PersonaCache[]> {
    const todas = await this.db.getAll<PersonaCache>('personas');
    return todas.filter(p => p.zona === zonaRequerida);
  }

  // EL CORAZÓN OFFLINE: Transacción simulada
  public async marcarAsistenciaOffline(idPersona: string, estado: boolean): Promise<void> {
    const database = await this.db.init();
    const timestampActual = new Date().getTime();

    return new Promise((resolve, reject) => {
      // Abrimos transacción sobre las DOS tablas
      const tx = database.transaction(['personas', 'outbox'], 'readwrite');
      const storePersonas = tx.objectStore('personas');
      const storeOutbox = tx.objectStore('outbox');

      // 1. Actualizamos la caché visual
      const getReq = storePersonas.get(idPersona);
      getReq.onsuccess = () => {
        const persona: PersonaCache = getReq.result;
        if (persona) {
          persona.asistencia = estado;
          persona.ultimaModificacion = timestampActual;
          storePersonas.put(persona);
        }
      };

      // 2. Insertamos en la cola de sincronización
      const evento: OutboxEvent = {
        idEvento: crypto.randomUUID(), // ID único nativo
        idPersona: idPersona,
        nuevoEstado: estado,
        timestamp: timestampActual,
        intentos: 0
      };
      storeOutbox.put(evento);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
}