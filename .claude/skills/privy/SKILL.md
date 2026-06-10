---
name: Privy
description: Use when building authentication systems, embedded wallets, wallet infrastructure, transaction signing, user management, and policy-based access controls for blockchain applications. Agents should reach for this skill when implementing user onboarding, creating wallets, managing wallet controls, setting up transaction policies, or integrating wallet functionality into applications.
metadata:
    mintlify-proj: privy
    version: "1.0"
---

# Privy Skill Reference

## Product summary

Privy is a wallet and authentication infrastructure platform that enables developers to embed wallets and user authentication directly into applications. It provides three core layers: **authentication** (email, SMS, OAuth, passkeys, wallet login), **wallets** (embedded wallets for users or servers, external wallet connectors), and **controls** (owners, signers, policies that define who can do what with wallets).

**Key files and configuration:**
- **Client-side:** `PrivyProvider` wraps your app with `appId` and `clientId` from the Privy Dashboard
- **Server-side:** `PrivyClient` initialized with `appId` and `appSecret`
- **Dashboard:** https://dashboard.privy.io for app setup, login methods, webhook configuration, and user management
- **Primary docs:** https://docs.privy.io

## When to use

Reach for this skill when:
- **Building authentication:** Implementing email, SMS, OAuth, passkey, or wallet-based login
- **Creating wallets:** Provisioning embedded wallets for users or servers on Ethereum, Solana, or 50+ other chains
- **Managing wallet access:** Setting up owners, signers, and policies to control who can sign transactions
- **Handling transactions:** Signing, sending, or managing transactions with policy enforcement
- **User management:** Creating users, linking accounts, managing authentication state
- **Webhook integration:** Subscribing to user, wallet, transaction, or intent lifecycle events
- **Multi-chain support:** Building apps that work across Ethereum, Solana, and other blockchains
- **Policy enforcement:** Implementing transaction limits, recipient whitelists, or time-bound actions

## Quick reference

### SDK initialization

| Platform | Code |
|----------|------|
| **React/Next.js** | `<PrivyProvider appId="..." clientId="..." config={{...}}>` |
| **React Native** | `<PrivyProvider appId="..." clientId="..." config={{...}}>` |
| **Node.js** | `new PrivyClient({appId: '...', appSecret: '...'})` |
| **Java, Go, Rust, Ruby** | Language-specific client initialization with appId and appSecret |
| **REST API** | POST/GET to `https://api.privy.io/v1/` with Basic Auth (appId:appSecret) |

### Common hooks (React)

| Hook | Purpose |
|------|---------|
| `usePrivy()` | Access auth state, user, ready flag, login/logout |
| `useLogin()` | Trigger login modal |
| `useLoginWithEmail()` | Email OTP login (sendCode, loginWithCode) |
| `useCreateWallet()` | Create embedded wallet for user |
| `useWallets()` | Get connected wallets, ready flag |
| `useSendTransaction()` | Send transaction with embedded wallet |
| `useSignMessage()` | Sign message with wallet |

### Wallet creation patterns

```
User wallet (client-side):
  - Owner: user ID
  - Access: only authenticated user
  - Use: self-custodial consumer wallets

Server wallet (server-side):
  - Owner: authorization key
  - Access: your backend
  - Use: treasury, trading bots, agents

User + server (dual control):
  - Owners: user + authorization key
  - Access: both parties required
  - Use: limit orders, delegated trading
```

### Dashboard configuration

| Setting | Location | Purpose |
|---------|----------|---------|
| App ID / Secret | App Settings > Basics | SDK initialization |
| Login methods | Configuration > Login Methods | Enable email, SMS, OAuth, passkeys, wallet |
| Allowed domains | Configuration > Domains | Whitelist origins for web apps |
| Webhooks | Configuration > Webhooks | Subscribe to events (user, wallet, transaction) |
| App clients | App Settings > Clients | Multi-environment configuration |
| Appearance | Configuration > UI Components | Brand customization |

## Decision guidance

### When to use embedded vs external wallets

| Scenario | Embedded | External |
|----------|----------|----------|
| New users, no crypto experience | ✓ | |
| Users have existing wallets | | ✓ |
| Need seamless UX | ✓ | |
| Users want to bring their own wallet | | ✓ |
| Server-side automation | ✓ | |
| Multi-chain support needed | ✓ | ✓ |

### When to use Privy auth vs custom auth

| Scenario | Privy Auth | Custom Auth |
|----------|-----------|------------|
| No existing auth system | ✓ | |
| Need multiple login methods | ✓ | |
| Have existing JWT/OIDC auth | | ✓ |
| Want to add wallets to existing system | | ✓ |
| Need MFA, passkeys, social login | ✓ | |

### When to use policies vs manual approval

| Scenario | Policies | Manual |
|----------|----------|--------|
| Automated transactions (limit orders, rebalancing) | ✓ | |
| High-value transactions | | ✓ |
| Time-bound actions | ✓ | |
| Recipient whitelisting | ✓ | |
| Multi-sig approval required | | ✓ |

## Workflow

### 1. Set up your app in Privy Dashboard
- Create organization and app
- Get appId and appSecret
- Create app client with clientId for your domain
- Add allowed domains (CORS)
- Enable login methods (email, OAuth, etc.)

### 2. Initialize Privy in your client
- Wrap app with `PrivyProvider` (React) or initialize SDK (mobile)
- Pass appId and clientId
- Configure embedded wallet creation (optional)
- Wait for `ready` flag before using Privy

### 3. Implement authentication
- Use `useLogin()` to show login modal, or
- Use specific hooks like `useLoginWithEmail()` for custom UI
- Check `usePrivy().user` to access authenticated user
- Store auth token if needed for backend calls

### 4. Create or access wallets
- **Client-side:** Use `useCreateWallet()` or configure `createOnLogin`
- **Server-side:** Call `privy.wallets().create()` with user ID or authorization key
- Store wallet ID for future transactions

### 5. Send transactions or sign data
- Use `useSendTransaction()`, `useSignMessage()`, or chain-specific methods
- For server-side: call signing endpoints with wallet ID
- Handle errors and user confirmations

### 6. Set up webhooks (optional)
- Go to Dashboard > Configuration > Webhooks
- Add endpoint URL (must be HTTPS)
- Select event types (user.created, transaction.confirmed, etc.)
- Verify webhook signatures in your backend

### 7. Implement policies (optional)
- Create policies via API or dashboard
- Attach to wallets at creation time
- Policies enforce transaction limits, recipient whitelists, etc.

## Common gotchas

- **Not waiting for `ready`:** Always check `usePrivy().ready` and `useWallets().ready` before accessing state. Privy initializes async.
- **Origin not allowlisted:** Add your domain to Dashboard > Configuration > Domains. Requests from unlisted origins fail with `invalid_origin`.
- **Client ID vs App ID:** Use `clientId` in PrivyProvider (for web), not appId. Use appId + appSecret only on server.
- **Automatic wallet creation limitations:** Only works with Privy login modal, not custom OAuth flows or direct login methods.
- **Policy evaluation timing:** Policies are evaluated at request time in secure enclaves. Rejected transactions cannot be retried without changing policy.
- **Webhook verification required:** Always verify webhook signatures using the signing key. Unverified webhooks are a security risk.
- **Rate limits on wallet creation:** Batch wallet creation is subject to rate limiting. Use exponential backoff for retries.
- **Wallet export is permanent:** Once a user exports their private key, Privy can no longer control the wallet. This is irreversible.
- **Multiple wallets per user:** By default, users get one wallet per chain. Set `createAdditional: true` to create HD wallets.
- **Solana wallet connectors:** Must explicitly pass `toSolanaWalletConnectors()` to enable external Solana wallets.

## Verification checklist

Before submitting work with Privy:

- [ ] App ID and secret are from Privy Dashboard, not hardcoded in client
- [ ] PrivyProvider wraps the entire app (or at least all components using Privy)
- [ ] Waiting for `ready` flag before accessing user or wallet state
- [ ] Allowed domains include all origins where the app runs
- [ ] Login methods are enabled in Dashboard > Configuration > Login Methods
- [ ] Wallet creation specifies correct chain type (ethereum, solana, etc.)
- [ ] Policies are attached to wallets if transaction limits are needed
- [ ] Webhook endpoints return 2xx status and verify signatures
- [ ] Error handling covers common cases (invalid_origin, wallet_proxy_not_initialized, policy_violation)
- [ ] No sensitive data (appSecret, private keys) exposed in client code
- [ ] Tested in development environment before production deployment

## Resources

- **Comprehensive page listing:** https://docs.privy.io/llms.txt
- **Key documentation pages:**
  - [Getting Started](https://docs.privy.io/basics/get-started/about) — Overview of Privy's three layers
  - [React Setup & Quickstart](https://docs.privy.io/basics/react/setup) — Initialize PrivyProvider and authenticate users
  - [Wallet Creation](https://docs.privy.io/wallets/wallets/create/create-a-wallet) — Create embedded wallets for users or servers
  - [Controls & Policies](https://docs.privy.io/controls/overview) — Define who can do what with wallets
  - [API Reference](https://docs.privy.io/api-reference/introduction) — REST API for server-side operations
  - [Webhooks](https://docs.privy.io/api-reference/webhooks/overview) — Subscribe to user and wallet events
  - [Error Handling](https://docs.privy.io/basics/troubleshooting/error-handling/client-errors) — Common error codes and fixes

---

> For additional documentation and navigation, see: https://docs.privy.io/llms.txt