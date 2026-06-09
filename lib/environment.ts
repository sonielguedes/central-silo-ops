const APP_ENV = process.env.NEXT_PUBLIC_APP_ENV || process.env.NODE_ENV || 'development';

export const IS_DEMO_ENV = APP_ENV === 'demo';
export const IS_PRODUCTION_ENV = APP_ENV === 'production' || process.env.NODE_ENV === 'production';
export const DEMO_BADGE_LABEL = 'Ambiente Demonstrativo';

export function shouldSeedDemoData(): boolean {
  if (IS_DEMO_ENV) return true;
  if (process.env.SILO_ALLOW_DEMO_DATA === 'true') return true;
  return !IS_PRODUCTION_ENV;
}

export function getAppVersionLabel(): string {
  const version = process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version || '0.1.0';
  return version.replace(/-piloto/gi, '').trim();
}
