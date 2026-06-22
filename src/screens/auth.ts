export type AuthViewAssets = {
  logoUrl: string;
  solaLetterUrl: string;
  adoracionHeroUrl: string;
};

export function renderAdminLoginView({ logoUrl, solaLetterUrl, adoracionHeroUrl }: AuthViewAssets): string {
  // Ventana de acceso: todos los campos mantienen sus ids originales para validacion y login.
  return `
    <section id="vista-admin-login" class="view admin-login-view" style="--landing-bg: url('${adoracionHeroUrl}'); display: none;">
      <video class="auth-bg-video optional-bg-video" autoplay muted loop playsinline preload="auto" poster="${adoracionHeroUrl}" aria-hidden="true">
        <source src="/landing-video.mp4" type="video/mp4" />
      </video>
      <header class="auth-topbar">
        <button class="icon-only back-button auth-back-button" type="button" data-view="inicio" aria-label="Volver">
          <span aria-hidden="true">‹</span>
          <span>Volver</span>
        </button>
        <img src="${solaLetterUrl}" alt="A Solas" class="auth-wordmark" />
        <span aria-hidden="true"></span>
      </header>

      <form id="form-admin-login" class="admin-login-card" novalidate>
        <section class="auth-welcome" aria-label="Inicio de sesion">
         <!-- <div class="auth-logo-wrap" aria-hidden="true">
            <img src="${logoUrl}" alt="Logo A Solas" class="auth-logo" />
          </div>-->
            <h1>Iniciar sesion</h1>
        </section>

        <section class="auth-form-panel" aria-label="Credenciales de acceso">
          <label class="auth-field auth-icon-field auth-icon-email" data-field="admin-email">
            <span>Correo electronico</span>
            <input id="admin-email" type="email" autocomplete="username" inputmode="email" placeholder="Ingresa tu correo electronico" required aria-describedby="admin-email-error" />
            <small id="admin-email-error" class="field-error"></small>
          </label>

          <label class="auth-field auth-icon-field auth-icon-lock auth-password-field" data-field="admin-password">
            <span>Contrasena</span>
            <input id="admin-password" type="password" autocomplete="current-password" placeholder="Ingresa tu contrasena" required aria-describedby="admin-password-error" />
            <button type="button" data-action="toggle-admin-password" aria-label="Mostrar contrasena">◉</button>
            <small id="admin-password-error" class="field-error"></small>
          </label>

          <div class="auth-options">
            <label class="auth-remember">
              <input id="admin-remember" type="checkbox" />
              <span>Recordarme</span>
            </label>
            <button class="auth-link-button" type="button" data-action="forgot-password">¿Olvidaste tu contrasena?</button>
          </div>

          <p id="admin-login-mensaje" class="modal-message" role="status"></p>

          <button class="button button-primary auth-submit" type="submit">Iniciar sesion <span aria-hidden="true"></span></button>

          <div class="auth-divider" aria-hidden="true"><span>ó</span></div>

          <p class="auth-create-account">¿No tienes cuenta? <button type="button" data-view="registro-adorador">Crear cuenta</button></p>
        </section>
      </form>
    </section>
  `;
}

export function renderRegisterView({ logoUrl, solaLetterUrl, adoracionHeroUrl }: AuthViewAssets): string {
  // Ventana de registro: el formulario por pasos se hidrata despues desde main.ts.
  return `
    <section id="vista-registro-adorador" class="view registro-view" style="--landing-bg: url('${adoracionHeroUrl}'); display: none;">
      <video class="auth-bg-video optional-bg-video" autoplay muted loop playsinline preload="auto" poster="${adoracionHeroUrl}" aria-hidden="true">
        <source src="/landing-video.mp4" type="video/mp4" />
      </video>
      <header class="auth-topbar registro-topbar">
        <button class="icon-only back-button auth-back-button" type="button" data-view="inicio" aria-label="Volver">
          <span aria-hidden="true">‹</span>
          <span>Volver</span>
        </button>
        <img src="${solaLetterUrl}" alt="A Solas" class="auth-wordmark" />
        <span aria-hidden="true"></span>
      </header>

      <form id="form-registro-adorador" class="registro-form" novalidate>
        <div class="registro-shell">
          <section class="auth-welcome registro-welcome" aria-label="Crear cuenta">
            <!--<div class="auth-logo-wrap" aria-hidden="true">
              <img src="${logoUrl}" alt="Logo A Solas" class="auth-logo" />
            </div> -->
            <h1>Crea tu cuenta</h1>
          </section>

          <div class="registro-content auth-form-panel">
            <div class="registro-progress" aria-label="Progreso del registro">
              <span></span>
              <strong id="registro-step-label">1 de 3</strong>
            </div>

            <div class="registro-slider">
            <section class="registro-group" data-registro-step="0" aria-label="Identidad">
              <header>
                <span>1</span>
                <div>
                  <h3>Identidad</h3>
                </div>
              </header>
              <div class="registro-grid">
                <label class="registro-field" data-field="registro-nombre">
                  <span>Nombre <em>Obligatorio</em></span>
                  <input id="registro-nombre" type="text" autocomplete="given-name" placeholder="Maria" minlength="2" required aria-describedby="registro-nombre-error" />
                  <small id="registro-nombre-error" class="field-error"></small>
                </label>
                <label class="registro-field" data-field="registro-apellidos">
                  <span>Apellidos <em>Obligatorio</em></span>
                  <input id="registro-apellidos" type="text" autocomplete="family-name" placeholder="Garcia Lopez" minlength="2" required aria-describedby="registro-apellidos-error" />
                  <small id="registro-apellidos-error" class="field-error"></small>
                </label>
              </div>
            </section>

            <section class="registro-group" data-registro-step="1" aria-label="Acceso" hidden>
              <header>
                <span>2</span>
                <div>
                  <h3>Acceso</h3>
                  <p>Usa estas credenciales para entrar despues desde cualquier dispositivo.</p>
                </div>
              </header>
              <div class="registro-grid">
                <label class="registro-field" data-field="registro-email">
                  <span>Correo electronico <em>Obligatorio</em></span>
                  <input id="registro-email" type="email" autocomplete="email" inputmode="email" placeholder="maria@email.com" required aria-describedby="registro-email-error" />
                  <small id="registro-email-error" class="field-error"></small>
                </label>
                <label class="registro-field" data-field="registro-password">
                  <span>Contrasena <em>Obligatorio</em></span>
                  <input id="registro-password" type="password" autocomplete="new-password" placeholder="Minimo 6 caracteres" minlength="6" required aria-describedby="registro-password-error" />
                  <small id="registro-password-error" class="field-error"></small>
                </label>
                <label class="registro-field" data-field="registro-password-confirm">
                  <span>Confirmar contrasena <em>Obligatorio</em></span>
                  <input id="registro-password-confirm" type="password" autocomplete="new-password" placeholder="Repite la contrasena" minlength="6" required aria-describedby="registro-password-confirm-error" />
                  <small id="registro-password-confirm-error" class="field-error"></small>
                </label>
              </div>
            </section>

            <section class="registro-group" data-registro-step="2" aria-label="Preferencia" hidden>
              <header>
                <span>3</span>
                <div>
                  <h3>Preferencia</h3>
                  <p>Ayuda a organizar la cobertura habitual de la capilla.</p>
                </div>
              </header>
              <div class="registro-grid">
                <label class="registro-field registro-select-field" data-field="registro-frecuencia">
                  <span>Frecuencia <em>Obligatorio</em></span>
                  <select id="registro-frecuencia" required aria-describedby="registro-frecuencia-error">
                    <option value="fijo">Fijo</option>
                    <option value="suplente">Suplente</option>
                    <option value="puntual" selected>Puntual</option>
                  </select>
                  <small id="registro-frecuencia-error" class="field-error"></small>
                </label>
                <label class="registro-field" data-field="registro-telefono">
                  <span>Telefono <em>Opcional</em></span>
                  <input id="registro-telefono" type="tel" autocomplete="tel" inputmode="tel" placeholder="+34 600 000 000" aria-describedby="registro-telefono-error" />
                  <small id="registro-telefono-error" class="field-error"></small>
                </label>
              </div>
            </section>
            </div>

            <p id="registro-mensaje" class="registro-message" role="status"></p>

            <div class="registro-slider-actions">
              <button id="registro-prev" class="registro-nav-button" type="button" data-action="registro-prev" disabled>Anterior</button>
              <button id="registro-next" class="registro-submit" type="button" data-action="registro-next">Siguiente</button>
              <button id="registro-submit" class="registro-submit" type="submit" disabled hidden>Finalizar</span></button>
            </div>

            <div class="auth-divider" aria-hidden="true"><span>ó</span></div>

            <p class="auth-create-account">¿Ya tienes cuenta? <button type="button" data-view="admin-login">Iniciar sesion</button></p>
          </div>
        </div>
      </form>
    </section>
  `;
}
