import './style.css';
import { requiredElement } from './dom';
import { AuthService } from './services/auth_service';
import { renderAdminDashboardView } from './views/admin_dashboard_view';
import { renderAdminLoginView } from './views/admin_login_view';
import { renderUsuarioView } from './views/usuario_view';

const app = requiredElement<HTMLDivElement>(document, '#app');

function navigate(hash: string): void {
  if (window.location.hash === hash) {
    renderRoute();
    return;
  }

  window.location.hash = hash;
}

function renderRoute(): void {
  const route = window.location.hash || '#/usuario';

  if (route === '#/admin/login') {
    if (AuthService.isAuthenticated()) {
      navigate('#/admin');
      return;
    }

    renderAdminLoginView(app, () => navigate('#/admin'));
    return;
  }

  if (route === '#/admin') {
    if (!AuthService.isAuthenticated()) {
      navigate('#/admin/login');
      return;
    }

    renderAdminDashboardView(app, () => navigate('#/admin/login'));
    return;
  }

  renderUsuarioView(app);
}

window.addEventListener('hashchange', renderRoute);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}

renderRoute();
