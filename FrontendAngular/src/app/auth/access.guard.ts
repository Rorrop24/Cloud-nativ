import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { hasAccess } from './claims';

export const accessGuard: CanActivateFn = async route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  try {
    const claims = await auth.accessClaims();
    const roles = (route.data['roles'] ?? []) as string[];
    const scopes = (route.data['scopes'] ?? []) as string[];
    return hasAccess(claims, roles, scopes) || router.createUrlTree(['/acceso-denegado']);
  } catch {
    return router.createUrlTree(['/acceso-denegado']);
  }
};
