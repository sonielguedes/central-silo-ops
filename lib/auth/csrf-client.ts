export function getCsrfTokenFromDocument(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.split('; ').find((entry) => entry.startsWith('silo_csrf='));
  if (!match) return null;
  return decodeURIComponent(match.slice('silo_csrf='.length)) || null;
}
