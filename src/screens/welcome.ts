export type WelcomeViewAssets = {
  adoracionHeroUrl: string;
  solaLetterUrl: string;
  appVersion: string;
};

export function renderWelcomeView({ adoracionHeroUrl, solaLetterUrl, appVersion }: WelcomeViewAssets): string {
  // Ventana inicial: conserva ids y data-view para que el enrutador de main.ts siga funcionando.
  return `
    <section id="vista-inicio" class="view welcome-view" style="--landing-bg: url('${adoracionHeroUrl}')">
      <video id="landing-video" class="welcome-video optional-bg-video" autoplay muted loop playsinline preload="auto" poster="${adoracionHeroUrl}" aria-hidden="true">
        <source src="/landing-video.mp4" type="video/mp4" />
      </video>
      <button class="landing-sound-button" type="button" data-action="toggle-landing-sound" aria-label="Activar sonido del video" aria-pressed="false" hidden>Sonido</button>
      <div class="welcome-screen">
        <header class="welcome-copy">
          <h1 class="sr-only">A Solas</h1>
          <img src="${solaLetterUrl}" alt="A Solas" class="welcome-wordmark" />
          <p>Adoraci&oacute;n organizada, turnos claros y horas sin exposici&oacute;n en un solo lugar.</p>
        </header>

        <div class="landing-actions">
          <button class="button button-primary landing-primary" type="button" data-view="admin-login">Iniciar sesion <span aria-hidden="true"></span></button>
          <button class="button button-secondary landing-secondary" type="button" data-view="registro-adorador">Crear cuenta</button>
        </div>

        <footer class="welcome-footer">
          <strong class="app-version">v${appVersion}</strong>
        </footer>
      </div>
    </section>
  `;
}
