import { TurnoRepository } from './data/turno_repo';
import { SyncWorker } from './services/sync_worker';
import type { PersonaCache } from './core/models';

const repo = new TurnoRepository();
const syncWorker = new SyncWorker();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}

// 1. Arrancar el listener en segundo plano
syncWorker.iniciarListener();

// 2. Inyectar datos de prueba para trabajar sin la API
async function mockData() {
  const mockPersonas: PersonaCache[] = [
    { id: "101", nombre: "Ana García", zona: "Sector Norte", horarioIso: "2026-06-10T08:00:00Z", asistencia: false, ultimaModificacion: 0 },
    { id: "102", nombre: "Carlos Ruiz", zona: "Sector Norte", horarioIso: "2026-06-10T08:00:00Z", asistencia: false, ultimaModificacion: 0 }
  ];
  await repo.guardarLotePersonas(mockPersonas);
  renderLista();
}

// 3. Renderizar la UI (Vanilla JS)
async function renderLista() {
  const lista = await repo.obtenerPorZona("Sector Norte");
  const appDiv = document.querySelector<HTMLDivElement>('#app')!;
  
  let html = `
    <div style="font-family: sans-serif; padding: 20px;">
      <h2>Control de Turnos (Modo Offline)</h2>
      <p>Estado de Red: <strong id="red-status">${navigator.onLine ? '🟢 Online' : '🔴 Offline'}</strong></p>
      <ul style="list-style: none; padding: 0;">
  `;

  lista.forEach(p => {
    html += `
      <li style="margin-bottom: 10px; padding: 10px; border: 1px solid #ccc; border-radius: 5px;">
        <strong>${p.nombre}</strong> <br/>
        <button 
          style="margin-top: 10px; padding: 10px; background: ${p.asistencia ? '#4CAF50' : '#f44336'}; color: white; border: none; border-radius: 4px;"
          onclick="marcar('${p.id}', ${!p.asistencia})">
          ${p.asistencia ? 'Desmarcar Asistencia' : 'Marcar Asistió'}
        </button>
      </li>
    `;
  });

  html += `</ul></div>`;
  appDiv.innerHTML = html;
}

// 4. Conectar el clic del botón HTML con TypeScript
(window as any).marcar = async (id: string, estado: boolean) => {
  await repo.marcarAsistenciaOffline(id, estado); // Guarda en DB y mete en cola
  renderLista(); // Recarga la UI inmediatamente (Optimistic Update)
};

// Listeners visuales para el indicador de red
window.addEventListener('offline', () => document.getElementById('red-status')!.innerHTML = '🔴 Offline');
window.addEventListener('online', () => document.getElementById('red-status')!.innerHTML = '🟢 Online');

// Arrancar la app
mockData();
