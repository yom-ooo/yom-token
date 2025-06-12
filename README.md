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

## Viewing Tax Information

The token keeps separate counters for buy and sell taxes. Public view functions provide insights:

- `totalTaxCollected()` – total tokens collected from both taxes.
- `getTaxBreakdown()` – returns buy tax, sell tax and the combined total.
- `isTaxExempt(address)` – check if an address is excluded from tax.

## Do You Need Token‑Level Taxes?

Uniswap v3 pools already charge trading fees. These fees stay inside the pool and are distributed to LPs. The tax logic in `YOM.sol` applies at the token level and is independent of any DEX. 

**Pros of having built‑in taxes**

- Works across all AMM pairs and transfers, not just on Uniswap.
- Revenue goes directly to your `feeCollector`, rather than remaining in a pool.
- Buy vs. sell taxation can be customised.

**Cons**

- Some wallets and DeFi protocols do not handle transfer‑fee tokens gracefully.
- Slightly higher gas cost for transfers.
- Relies on admin functions to manage AMM pairs and tax‑exempt addresses.

If your goal is to capture revenue from all on‑chain trading (including other DEXs or cross‑chain bridges), token‑level taxes make sense. If you only need fees on a single Uniswap pool, the native pool fee might be sufficient and keeps your token fully standard.

