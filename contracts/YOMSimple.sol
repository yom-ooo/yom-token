// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * YOMSimple - Simplified version for local testing without LayerZero
 */
contract YOMSimple is ERC20, ERC20Burnable, ERC20Permit, Pausable, Ownable {
    /* ── constants ── */
    uint256 public constant BPS_DENOM = 10_000;
    uint256 public constant MAX_TAX_BPS = 1_000; // 10 %
    uint256 public constant TAX_COOLDOWN = 1; // blocks for MEV protection

    /* ── state variables ── */
    address public feeCollector;
    uint96 public buyTaxBps = 200;      // 2%
    uint96 public sellTaxBps = 300;     // 3%
    
    uint128 public totalBuyTaxCollected;
    uint128 public totalSellTaxCollected;

    mapping(address => bool) public ammPairs;
    mapping(address => bool) public isExcluded;
    mapping(address => bool) public isFrozen;
    mapping(address => uint256) public lastTaxedBlock;

    /* ── errors ── */
    error Frozen(address account);
    error ZeroAddress();
    error TaxTooHigh();
    error TokenPaused();
    error CooldownActive();

    /* ── events ── */
    event TaxRatesUpdated(uint256 buyBps, uint256 sellBps);
    event FeeCollectorUpdated(address indexed prev, address indexed curr);
    event AMMPairUpdated(address indexed pair, bool enabled);
    event ExclusionUpdated(address indexed account, bool excluded);
    event FreezeUpdated(address indexed account, bool frozen);
    event TaxCollected(address indexed from, uint256 amount, bool isBuy);

    constructor(
        address initialOwner,
        address, // lzEndpoint - ignored in simple version
        address  // delegate - ignored in simple version
    ) 
        ERC20("YOM", "YOM")
        ERC20Permit("YOM")
        Ownable(initialOwner)
    {
        if (initialOwner == address(0)) revert ZeroAddress();
        
        _mint(initialOwner, 300_000_000 ether);   // 300 M YOM

        feeCollector = initialOwner;
        isExcluded[initialOwner] = true;
        isExcluded[address(this)] = true;
        isExcluded[feeCollector] = true;
    }

    function _update(address from, address to, uint256 amount) internal override {
        if (amount == 0) return;
        if (paused()) revert TokenPaused();
        if (isFrozen[from]) revert Frozen(from);
        if (isFrozen[to]) revert Frozen(to);

        uint256 fee;
        bool isBuy;
        
        if (!isExcluded[from] && !isExcluded[to]) {
            if (ammPairs[from]) {
                if (block.number <= lastTaxedBlock[to] + TAX_COOLDOWN) {
                    revert CooldownActive();
                }
                fee = amount * buyTaxBps / BPS_DENOM;
                isBuy = true;
                lastTaxedBlock[to] = block.number;
            } else if (ammPairs[to]) {
                if (block.number <= lastTaxedBlock[from] + TAX_COOLDOWN) {
                    revert CooldownActive();
                }
                fee = amount * sellTaxBps / BPS_DENOM;
                isBuy = false;
                lastTaxedBlock[from] = block.number;
            }
        }

        if (fee != 0) {
            if (isBuy) {
                totalBuyTaxCollected += uint128(fee);
            } else {
                totalSellTaxCollected += uint128(fee);
            }
            
            emit TaxCollected(from, fee, isBuy);
            super._update(from, feeCollector, fee);
            amount -= fee;
        }
        
        super._update(from, to, amount);
    }

    /* ── Owner functions ── */
    function setTaxRates(uint256 buyBps, uint256 sellBps) external onlyOwner {
        if (buyBps > MAX_TAX_BPS || sellBps > MAX_TAX_BPS) revert TaxTooHigh();
        buyTaxBps = uint96(buyBps);
        sellTaxBps = uint96(sellBps);
        emit TaxRatesUpdated(buyBps, sellBps);
    }

    function setFeeCollector(address newC) external onlyOwner {
        if (newC == address(0)) revert ZeroAddress();
        isExcluded[feeCollector] = false;
        emit FeeCollectorUpdated(feeCollector, newC);
        feeCollector = newC;
        isExcluded[newC] = true;
    }

    function setAMMPair(address pair, bool enabled) external onlyOwner {
        if (pair == address(0)) revert ZeroAddress();
        ammPairs[pair] = enabled;
        emit AMMPairUpdated(pair, enabled);
    }

    function setExclusion(address acct, bool excluded) external onlyOwner {
        isExcluded[acct] = excluded;
        emit ExclusionUpdated(acct, excluded);
    }

    function freeze(address acct, bool frozen) external onlyOwner {
        isFrozen[acct] = frozen;
        emit FreezeUpdated(acct, frozen);
    }

    function pause() external onlyOwner { 
        _pause(); 
    }
    
    function unpause() external onlyOwner { 
        _unpause(); 
    }

    /* ── View helpers ── */
    function getTaxBreakdown() external view returns (
        uint256 buyTax,
        uint256 sellTax,
        uint256 total
    ) {
        buyTax = totalBuyTaxCollected;
        sellTax = totalSellTaxCollected;
        total = uint256(buyTax) + uint256(sellTax);
    }
}