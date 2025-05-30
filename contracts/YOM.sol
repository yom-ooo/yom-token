// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/* ── OpenZeppelin ── */
import {ERC20}           from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20Burnable}   from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit}     from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Pausable}        from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable}         from "@openzeppelin/contracts/access/Ownable.sol";

/* ── LayerZero OFT V2 ── */
import {OFT}             from "@layerzerolabs/oft-evm/contracts/OFT.sol";

/**
 * ███  YOM – Omnichain ERC-20  ███
 *
 * • 2 % buy / 3 % sell tax (LP-only) routed to feeCollector  
 * • LayerZero OFT bridge (v3.1.x)  
 * • OZ 5 extensions: Burnable, Permit (EIP-2612), Pausable  
 * • Freeze list, tax-exempt list, bulk admin helpers, rescue utils  
 */
contract YOM is
    OFT,                // ← first - resolves ERC20/Context once
    ERC20Burnable,
    ERC20Permit,
    Pausable
{
    /* ── constants ── */
    uint256 public constant BPS_DENOM = 10_000;
    uint256 public constant MAX_TAX_BPS = 1_000; // 10 %

    /* ── state ── */
    address public feeCollector;
    uint256 public buyTaxBps  = 200; // 2 %
    uint256 public sellTaxBps = 300; // 3 %
    uint256 public totalTaxCollected;

    mapping(address => bool) public ammPairs;
    mapping(address => bool) public isExcluded;
    mapping(address => bool) public isFrozen;

    /* ── errors ── */
    error Frozen(address);
    error ZeroAddress();
    error TaxTooHigh();
    error CannotRescueYOM();
    error EthTransferFail();

    /* ── events ── */
    event TaxRatesUpdated(uint256 buyBps, uint256 sellBps);
    event FeeCollectorUpdated(address indexed prev, address indexed curr);
    event AMMPairUpdated(address indexed pair, bool enabled);
    event ExclusionUpdated(address indexed account, bool excluded);
    event FreezeUpdated(address indexed account, bool frozen);
    event RescueERC20(address indexed token, address indexed to, uint256 amount);
    event RescueETH(address indexed to, uint256 amount);

    /* ── constructor ── */
    constructor(
        address initialOwner,  // recipient of the initial supply
        address lzEndpoint,    // LayerZero endpoint
        address delegate       // contract owner (can be the DAO multisig)
    )
        OFT("YOM", "YOM", lzEndpoint, delegate)
        ERC20Permit("YOM")
        Ownable(initialOwner)          // OZ-5 Ownable in LayerZero stack
    {
        _mint(initialOwner, 300_000_000 ether);   // 300 M YOM

        feeCollector              = initialOwner;
        isExcluded[initialOwner]  = true;
        isExcluded[address(this)] = true;
        isExcluded[feeCollector]  = true;

        // If the delegate (owner) is different from the initial receiver,
        // exclude it from tax as well.
        if (delegate != address(0) && delegate != initialOwner) {
            isExcluded[delegate] = true;
        }
    }

    /* ── tax + freeze + pause ── */
    function _update(address from, address to, uint256 amount)
        internal
        override
    {
        if (paused()) revert("YOM: paused");
        if (isFrozen[from] || isFrozen[to]) revert Frozen(isFrozen[from] ? from : to);

        uint256 fee;
        if (
            amount != 0 &&
            !isExcluded[from] &&
            !isExcluded[to]
        ) {
            if (ammPairs[from])      fee = amount * buyTaxBps  / BPS_DENOM; // buy
            else if (ammPairs[to])   fee = amount * sellTaxBps / BPS_DENOM; // sell
        }

        if (fee != 0) {
            totalTaxCollected += fee;
            super._update(from, feeCollector, fee);
            amount -= fee;
        }
        super._update(from, to, amount);
    }

    /* ── owner controls ── */
    function setTaxRates(uint256 buyBps, uint256 sellBps) external onlyOwner {
        if (buyBps > MAX_TAX_BPS || sellBps > MAX_TAX_BPS) revert TaxTooHigh();
        buyTaxBps  = buyBps;
        sellTaxBps = sellBps;
        emit TaxRatesUpdated(buyBps, sellBps);
    }

    function setFeeCollector(address newC) external onlyOwner {
        if (newC == address(0)) revert ZeroAddress();
        isExcluded[feeCollector] = false;
        emit FeeCollectorUpdated(feeCollector, newC);
        feeCollector           = newC;
        isExcluded[newC]       = true;
    }

    function setAMMPair(address pair, bool enabled) external onlyOwner {
        if (pair == address(0)) revert ZeroAddress();
        ammPairs[pair] = enabled;
        emit AMMPairUpdated(pair, enabled);
    }
    function setAMMPairs(address[] calldata pairs, bool enabled) external onlyOwner {
        for (uint256 i; i < pairs.length; ++i) {
            address p = pairs[i];
            if (p == address(0)) revert ZeroAddress();
            ammPairs[p] = enabled;
            emit AMMPairUpdated(p, enabled);
        }
    }

    function setExclusion(address acct, bool excluded) external onlyOwner {
        isExcluded[acct] = excluded;
        emit ExclusionUpdated(acct, excluded);
    }
    function setExclusions(address[] calldata accts, bool excluded) external onlyOwner {
        for (uint256 i; i < accts.length; ++i) {
            isExcluded[accts[i]] = excluded;
            emit ExclusionUpdated(accts[i], excluded);
        }
    }

    function freeze(address acct, bool frozen) external onlyOwner {
        isFrozen[acct] = frozen;
        emit FreezeUpdated(acct, frozen);
    }
    function freezeBatch(address[] calldata accts, bool frozen) external onlyOwner {
        for (uint256 i; i < accts.length; ++i) {
            isFrozen[accts[i]] = frozen;
            emit FreezeUpdated(accts[i], frozen);
        }
    }

    function pause()   external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /* ── rescue ── */
    function rescueERC20(address token, uint256 amt, address to) external onlyOwner {
        if (token == address(this)) revert CannotRescueYOM();
        IERC20(token).transfer(to, amt);
        emit RescueERC20(token, to, amt);
    }
    function rescueETH(address to, uint256 amt) external onlyOwner {
        (bool ok, ) = to.call{value: amt}("");
        if (!ok) revert EthTransferFail();
        emit RescueETH(to, amt);
    }
    receive() external payable {}

    /* ── view helpers ── */
    function isAMMPair(address a)   external view returns (bool) { return ammPairs[a]; }
    function isTaxExempt(address a) external view returns (bool) { return isExcluded[a]; }
    function isAccountFrozen(address a) external view returns (bool) { return isFrozen[a]; }
}
