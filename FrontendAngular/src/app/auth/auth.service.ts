import { inject, Injectable, signal } from '@angular/core';
import { MsalService } from '@azure/msal-angular';
import { InteractionRequiredAuthError } from '@azure/msal-browser';
import { APP_CONFIG } from '../app-config';
import { AccessClaims, readAccessClaims } from './claims';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly msal = inject(MsalService);
  private readonly config = inject(APP_CONFIG);
  readonly account = signal(this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0] ?? null);
  readonly claims = signal<AccessClaims | null>(null);
  readonly error = signal('');

  refreshAccount(): void {
    const account = this.msal.instance.getActiveAccount() ?? this.msal.instance.getAllAccounts()[0] ?? null;
    this.msal.instance.setActiveAccount(account);
    this.account.set(account);
    if (!account) this.claims.set(null);
  }

  login(): void {
    this.error.set('');
    this.msal.loginRedirect({ scopes: [this.config.apiScope] }).subscribe({
      error: () => this.error.set('No se pudo iniciar sesion. Intenta nuevamente.'),
    });
  }

  logout(): void {
    this.claims.set(null);
    this.error.set('');
    this.msal.logoutRedirect({ account: this.account() ?? undefined }).subscribe({
      error: () => this.error.set('No se pudo cerrar sesion. Intenta nuevamente.'),
    });
  }

  async accessClaims(): Promise<AccessClaims> {
    this.refreshAccount();
    const account = this.account();
    if (!account) throw new Error('Sin sesion');
    try {
      const result = await this.msal.instance.acquireTokenSilent({ account, scopes: [this.config.apiScope] });
      const claims = readAccessClaims(result.accessToken);
      this.claims.set(claims);
      return claims;
    } catch (error) {
      if (error instanceof InteractionRequiredAuthError) {
        await this.msal.instance.acquireTokenRedirect({ account, scopes: [this.config.apiScope] });
      }
      throw error;
    }
  }
}
