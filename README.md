# YOM Token

`YOM.sol` implements an omnichain ERC‑20 token with a fixed supply and several advanced features. The contract is written for Solidity ^0.8.28 and leverages OpenZeppelin and LayerZero libraries.

## Key Features

- **300 million supply at deployment** – minted to the provided `initialOwner`.
- **Buy/Sell taxes** – default 2 % on buys and 3 % on sells (LP transfers only) collected to `feeCollector`.
- **LayerZero OFT bridge** – enables cross‑chain transfers.
- **ERC‑20 extensions** – Burnable, Permit (EIP‑2612) and Pausable functionality.
- **Freeze list and tax‑exempt list** – addresses can be frozen or excluded from tax.
- **MEV protection** – cooldown logic prevents rapid back‑to‑back buys or sells.
- **Admin utilities** – bulk updates of AMM pairs, exclusions and freezes; rescue functions for ERC‑20 and ETH.

See [`contracts/YOM.sol`](contracts/YOM.sol) for the full implementation.

## Deployment

A deterministic deployment factory (`contracts/Factory.sol`) and Hardhat scripts are included. Update the LayerZero endpoint and salt in `scripts/deploy.ts`, then run Hardhat to deploy:

```bash
npx hardhat run scripts/deploy.ts --network <network>
```
