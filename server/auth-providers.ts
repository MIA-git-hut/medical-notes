import type { IdentityProvider } from './auth'
import type { LoginProviderDescriptor } from '../shared/auth'

/** Register only configured implementations. Reserved contracts do not enable a provider. */
export interface OAuthRegistration {
  id: string
  label: string
  implementation: IdentityProvider
  recoveryUrl?: string
}
export function providerRegistry(providers: OAuthRegistration[]) {
  const registry = new Map<string, OAuthRegistration>()
  for (const provider of providers) {
    if (!/^[a-z][a-z0-9-]{0,39}$/.test(provider.id) || registry.has(provider.id)) throw new Error('Invalid or duplicate authentication provider')
    if (provider.recoveryUrl && new URL(provider.recoveryUrl).protocol !== 'https:') throw new Error('External recovery must use HTTPS')
    registry.set(provider.id, provider)
  }
  return registry
}
export function describeProvider(provider: OAuthRegistration): LoginProviderDescriptor {
  return { id: provider.id, label: provider.label, kind: 'oauth2', enabled: true,
    capabilities: { login: true, link: false, recovery: provider.recoveryUrl ? 'external' : 'none' }, startUrl: `/api/auth/${provider.id}/start` }
}
