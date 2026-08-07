# World-Class Permissionless Prediction Market Roadmap & Implementation Plan

To evolve our current prediction market platform into a secure, permissionless, and world-class protocol (similar to Polymarket or Augur), we must implement the following key features:

---

## 1. On-Chain Resolution Escrow & Dispute Bond Slasher
### Current Status:
Currently, rooms are resolved directly by either automated price feeds or the creator's designated arbitrator key. The frontend includes placeholder "Dispute" buttons, but they do not execute on-chain contract logic.

### Gaps:
- **No Escrow Security**: There is no on-chain mechanism to guarantee the arbitrator settles the market truthfully.
- **No Challenge Window**: Users cannot lock a dispute bond to challenge a false resolution.

### Proposed Implementation:
- **Challenge Collateral Bonds**: Introduce a dispute window (e.g., 24 hours) after an arbitrator/oracle posts a resolution. Any user can challenge by depositing a `Dispute Bond` (in USDC).
- **Overturn & Slasher Logic**: If a dispute is validated, the original arbitrator's fee is slashed and distributed to the challenger. If the dispute is invalid, the bond is forfeited to the arbitrator.
- **DAO Escalation**: Integrate community voting or decentralized Optimistic Oracle escalation to resolve disputes.

---

## 2. On-Chain Order Book / AMM (USDC Pools)
### Gaps:
- **Mock Trading Balance**: The frontend simulates order match balances and mock wagers without on-chain USDC smart contract interactions.
- **Slip slippage / Liquidity**: High stakes predictions need automated market makers (like Constant Product AMM or Polymarket's binary outcome formula) to provide predictable pricing.

### Proposed Implementation:
- **Solidity ERC-20 Escrow**: Integrate proper USDC deposits, transfers, and tokenized outcome shares (ERC-1155 or ERC-20 dynamic tokens) inside the main Solidity controller.

---

## 3. Optimistic Oracles (UMA Integration)
### Gaps:
- **Centralization Risk**: AI Agents are currently triggered via Express keep-alive endpoints. If the API key expires or the listener fails, rooms remain stuck.

### Proposed Implementation:
- **UMA Optimistic Oracle**: Deploy Solidity adapters connecting our rooms to UMA's Optimistic Oracle on Avalanche. 
- Arbitrators request resolutions on-chain, and disputes are resolved via UMA's Data Verification Mechanism (DVM) where token holders vote.

---

## 4. Cross-Chain Intents (Bridge USDC from any chain)
### Gaps:
- Fuji Testnet restriction. Users must manually bridge AVAX/USDC.

### Proposed Implementation:
- **Circle CCTP / Across Bridge**: Embed widget/bridges allowing Arbitrum/Base/Optimism users to deposit directly into Fuji using CCTP.
