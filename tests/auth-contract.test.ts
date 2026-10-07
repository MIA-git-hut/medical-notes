import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type {
  AuthChallenge,
  LoginProviderDescriptor,
  OAuthProviderAdapter,
  RecoveryProvider,
  VerifiedIdentity,
} from '../shared/auth'

describe('authentication extension contract', () => {
  it('uses provider and immutable subject as the external identity key', () => {
    const identity = {
      providerId: 'github',
      subject: '12345678',
      displayName: 'reader',
    } satisfies VerifiedIdentity

    assert.deepEqual([identity.providerId, identity.subject], ['github', '12345678'])
    assert.equal('userId' in identity, false)
  })

  it('requires enabled provider descriptors before a client may offer login', () => {
    const github = {
      id: 'github',
      label: 'GitHub',
      kind: 'oauth2',
      enabled: true,
      capabilities: { login: true, link: true, recovery: 'external' },
    } satisfies LoginProviderDescriptor
    const futurePhone = {
      id: 'phone',
      label: '手机号',
      kind: 'otp',
      enabled: false,
      capabilities: { login: false, link: false, recovery: 'none' },
    } satisfies LoginProviderDescriptor

    assert.deepEqual([github, futurePhone].filter((provider) => provider.enabled).map((provider) => provider.id), ['github'])
  })

  it('exposes discriminated public challenges without claiming an implementation', () => {
    const challenge: AuthChallenge = {
      id: 'challenge-1',
      providerId: 'phone',
      purpose: 'link',
      expiresAt: '2026-10-07T12:00:00.000Z',
      kind: 'otp',
      deliveryHint: '***1234',
      codeLength: 6,
    }

    assert.equal(challenge.kind, 'otp')
    assert.equal(challenge.deliveryHint, '***1234')
  })

  it('keeps OAuth exchange and bound-identity recovery as separate adapter contracts', () => {
    const oauthMethods: Array<keyof OAuthProviderAdapter> = ['descriptor', 'start', 'exchange']
    const recoveryMethods: Array<keyof RecoveryProvider> = ['descriptor', 'start', 'verifyBoundIdentityAndRevokeSessions']

    assert.deepEqual(oauthMethods, ['descriptor', 'start', 'exchange'])
    assert.deepEqual(recoveryMethods, ['descriptor', 'start', 'verifyBoundIdentityAndRevokeSessions'])
  })
})
