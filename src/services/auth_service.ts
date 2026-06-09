import { ApiService, type AdminSession } from '../api';

const STORAGE_KEY = 'hsss_hkn_admin_session';

export class AuthService {
  public static async login(usuario: string, password: string): Promise<AdminSession> {
    const session = await ApiService.loginAdmin(usuario, password);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
  }

  public static logout(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  public static getSession(): AdminSession | null {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return null;
    }

    try {
      const session = JSON.parse(raw) as AdminSession;

      if (!session.token || !session.usuario) {
        AuthService.logout();
        return null;
      }

      if (session.expiresAt && session.expiresAt <= Date.now()) {
        AuthService.logout();
        return null;
      }

      return session;
    } catch {
      AuthService.logout();
      return null;
    }
  }

  public static isAuthenticated(): boolean {
    return AuthService.getSession() !== null;
  }
}
