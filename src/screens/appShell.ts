import { renderAdminView } from './admin';
import { renderAdminLoginView, renderRegisterView } from './auth';
import { renderConfigurationView, type WeekdayOption } from './configuration';
import { renderModalShells } from './modals';
import { renderUserView } from './user';
import { renderWelcomeView } from './welcome';

export type AppShellAssets = {
  logoUrl: string;
  solaLetterUrl: string;
  adoracionHeroUrl: string;
  appVersion: string;
  diasSemana: WeekdayOption[];
};

export function renderAppShell(assets: AppShellAssets): string {
  // Ensambla las ventanas principales de la web en el orden esperado por los selectores existentes.
  return `
  <main class="app-shell">
    ${renderWelcomeView(assets)}
    ${renderAdminLoginView(assets)}
    ${renderAdminView()}
    ${renderUserView()}
    ${renderRegisterView(assets)}
    ${renderModalShells()}
    ${renderConfigurationView(assets.diasSemana)}
    <div id="sync-status" class="sync-status" role="status" hidden></div>
    <div id="toast-region" class="toast-region" aria-live="polite" aria-relevant="additions"></div>
  </main>
`;
}
