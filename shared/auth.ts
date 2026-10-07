/**
 * Provider-neutral authentication contracts.
 *
 * These types reserve extension points for future providers. They do not mean a
 * provider is configured or safe to display. A client may offer a login method
 * only when the server returns a descriptor with `enabled: true`.
 */

export type AuthPurpose = 'login' | 'link' | 'recover'
export type CredentialKind = 'oauth2' | 'qr' | 'otp' | 'password'
export type RecoveryCapability = 'external' | 'verified-contact' | 'none'

export interface LoginProviderDescriptor {
  /** Stable application-level provider key, for example `github`. */
  id: string
  label: string
  kind: CredentialKind
  enabled: boolean
  /** Present only when a configured provider exposes a browser login entrypoint. */
  startUrl?: string
  capabilities: {
    login: boolean
    link: boolean
    /** How an already-bound identity can prove account recovery. */
    recovery: RecoveryCapability
  }
}

interface ChallengeBase {
  /** Opaque, single-use server challenge identifier. */
  id: string
  providerId: string
  purpose: AuthPurpose
  expiresAt: string
}

export interface RedirectChallenge extends ChallengeBase {
  kind: 'redirect'
  redirectUrl: string
}

export interface QrChallenge extends ChallengeBase {
  kind: 'qr'
  /** Provider payload to encode; clients must not interpret it as an identity. */
  payload: string
  displayUrl?: string
}

export interface OtpChallenge extends ChallengeBase {
  kind: 'otp'
  /** Masked destination such as `***1234`; never a lookup key for account merging. */
  deliveryHint: string
  codeLength: number
}

export interface PasswordChallenge extends ChallengeBase {
  kind: 'password'
  usernameLabel: string
  passwordLabel: string
}

export type AuthChallenge = RedirectChallenge | QrChallenge | OtpChallenge | PasswordChallenge

export interface StartCredentialRequest {
  providerId: string
  purpose: AuthPurpose
  /** Validated same-origin path; providers must not accept arbitrary redirect URLs. */
  returnTo?: string
}

export type VerifyCredentialRequest =
  | { challengeId: string; kind: 'redirect'; code: string; state: string }
  | { challengeId: string; kind: 'qr'; confirmation: string }
  | { challengeId: string; kind: 'otp'; code: string }
  | { challengeId: string; kind: 'password'; username: string; password: string }

/** Stable external identity. Phone numbers, handles and email addresses are profile data, never public user IDs. */
export interface VerifiedIdentity {
  providerId: string
  /** Provider-issued immutable subject (`sub` or equivalent), not a phone number or display handle. */
  subject: string
  displayName?: string
  avatarUrl?: string
  verifiedContacts?: Array<{
    kind: 'email' | 'phone'
    value: string
  }>
}

export interface VerifiedCredential {
  purpose: AuthPurpose
  identity: VerifiedIdentity
}

/** General adapter used by QR, OTP or password-like credential mechanisms. */
export interface CredentialProvider {
  descriptor: LoginProviderDescriptor
  start(request: StartCredentialRequest): Promise<AuthChallenge>
  verify(request: VerifyCredentialRequest): Promise<VerifiedCredential>
}

/**
 * OAuth has an explicit start/exchange boundary so authorization codes remain
 * server-side adapter details. An integration may wrap this as a
 * `CredentialProvider`; the exchange result must still contain stable
 * `providerId + subject` identity.
 */
export interface OAuthProviderAdapter {
  descriptor: LoginProviderDescriptor & { kind: 'oauth2' }
  start(request: StartCredentialRequest): Promise<RedirectChallenge>
  exchange(request: Extract<VerifyCredentialRequest, { kind: 'redirect' }>): Promise<VerifiedCredential>
}

/** Server-trusted reference loaded from an account's existing identity binding. */
export interface BoundIdentityReference {
  identityId: string
  providerId: string
  subject: string
}

export interface StartRecoveryRequest {
  purpose: 'recover'
  /** Must come from an existing binding selected by the server, never a newly submitted phone/email. */
  boundIdentity: BoundIdentityReference
}

export interface VerifyRecoveryRequest {
  purpose: 'recover'
  challengeId: string
  boundIdentity: BoundIdentityReference
  proof: string
}

export interface RecoveryResult {
  identity: VerifiedIdentity
  revokedSessionIds: string[]
}

/**
 * Recovery verifies an identity already bound to the account and revokes its
 * old sessions. Implementations must reject a verified contact whose
 * `providerId + subject` differs from `boundIdentity`; a new phone number must
 * never trigger automatic account merging. No password recovery provider is
 * implemented by this contract.
 */
export interface RecoveryProvider {
  descriptor: LoginProviderDescriptor
  start(request: StartRecoveryRequest): Promise<AuthChallenge>
  verifyBoundIdentityAndRevokeSessions(request: VerifyRecoveryRequest): Promise<RecoveryResult>
}
