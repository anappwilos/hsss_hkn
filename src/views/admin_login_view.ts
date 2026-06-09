import { requiredElement } from '../dom';
import { AuthService } from '../services/auth_service';

type ToastType = 'loading' | 'success' | 'error';

export function renderAdminLoginView(container: HTMLElement, onLogin: () => void): void {
  container.innerHTML = `
    <main class="page-shell">
      <nav class="top-nav" aria-label="Navegacion principal">
        <a class="brand-link" href="#/usuario">hsss_hkn</a>
        <a class="nav-link" href="#/usuario">Area de usuario</a>
      </nav>

      <section class="signup-card" aria-labelledby="admin-login-title">
        <div id="admin-login-message" class="toast" role="status" aria-live="polite" hidden></div>

        <header class="card-header">
          <p class="eyebrow">Administracion</p>
          <h1 id="admin-login-title">Acceso privado</h1>
          <p class="subtitle">Inicia sesion para gestionar turnos, plazas e inscripciones.</p>
        </header>

        <form id="admin-login-form" class="signup-form">
          <label class="field">
            <span>Usuario</span>
            <input id="admin-user-input" name="usuario" type="text" autocomplete="username" required />
          </label>

          <label class="field">
            <span>Password</span>
            <input id="admin-password-input" name="password" type="password" autocomplete="current-password" required />
          </label>

          <button id="admin-login-button" class="primary-button" type="submit">
            Entrar
          </button>
        </form>
      </section>
    </main>
  `;

  const form = requiredElement<HTMLFormElement>(container, '#admin-login-form');
  const usuarioInput = requiredElement<HTMLInputElement>(container, '#admin-user-input');
  const passwordInput = requiredElement<HTMLInputElement>(container, '#admin-password-input');
  const button = requiredElement<HTMLButtonElement>(container, '#admin-login-button');
  const message = requiredElement<HTMLDivElement>(container, '#admin-login-message');

  function mostrarMensaje(tipo: ToastType, texto: string): void {
    message.textContent = texto;
    message.className = `toast toast--${tipo}`;
    message.hidden = false;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const usuario = usuarioInput.value.trim();
    const password = passwordInput.value;

    if (!usuario || !password) {
      mostrarMensaje('error', 'Introduce usuario y password');
      return;
    }

    button.textContent = 'Validando...';
    button.disabled = true;
    mostrarMensaje('loading', 'Validando credenciales...');

    try {
      await AuthService.login(usuario, password);
      mostrarMensaje('success', 'Sesion iniciada');
      onLogin();
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo iniciar sesion';
      mostrarMensaje('error', mensaje);
    } finally {
      button.textContent = 'Entrar';
      button.disabled = false;
    }
  });
}
