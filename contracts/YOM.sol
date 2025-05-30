// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/* ── OpenZeppelin ── */
import {ERC20}           from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20}          from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20}       from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
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
 * • MEV protection and gas optimizations
 */
contract YOM is
    OFT,                // ← first - resolves ERC20/Context once
    ERC20Burnable,
    ERC20Permit,
    Pausable
{
    using SafeERC20 for IERC20;

    /* ── constants ── */
    uint256 public constant BPS_DENOM = 10_000;
    uint256 public constant MAX_TAX_BPS = 1_000; // 10 %
    uint256 public constant MAX_BATCH_SIZE = 50; // DOS protection
    uint256 public constant TAX_COOLDOWN = 1; // blocks for MEV protection

    /* ── packed state variables for gas optimization ── */
    address public feeCollector;        // 20 bytes
    uint96 public buyTaxBps = 200;      // 12 bytes - 2%
    uint96 public sellTaxBps = 300;     // 12 bytes - 3%
    
    uint128 public totalBuyTaxCollected;  // 16 bytes - tracks buy tax separately
    uint128 public totalSellTaxCollected; // 16 bytes - tracks sell tax separately

    mapping(address => bool) public ammPairs;
    mapping(address => bool) public isExcluded;
    mapping(address => bool) public isFrozen;
    mapping(address => uint256) public lastTaxedBlock; // MEV protection

    /* ── errors ── */
    error Frozen(address account);
    error ZeroAddress();
    error TaxTooHigh();
    error CannotRescueYOM();
    error EthTransferFail();
    error TokenPaused();
    error BatchTooLarge();
    error ZeroAmount();
    error CooldownActive();

    /* ── events ── */
    event TaxRatesUpdated(uint256 buyBps, uint256 sellBps);
    event FeeCollectorUpdated(address indexed prev, address indexed curr);
    event AMMPairUpdated(address indexed pair, bool enabled);
    event ExclusionUpdated(address indexed account, bool excluded);
    event FreezeUpdated(address indexed account, bool frozen);
    event RescueERC20(address indexed token, address indexed to, uint256 amount);
    event RescueETH(address indexed to, uint256 amount);
    event TaxCollected(address indexed from, uint256 amount, bool isBuy);

    /* ── constructor ── */
    constructor(
        address initialOwner,  // recipient of initial supply AND initial owner
        address lzEndpoint,    // LayerZero endpoint
        address delegate       // LayerZero OFT delegate (can be same as owner)
    )
        OFT("YOM", "YOM", lzEndpoint, delegate)
        ERC20Permit("YOM")
        Ownable(initialOwner)
    {
        if (initialOwner == address(0)) revert ZeroAddress();
        
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

    /* ── tax + freeze + pause with MEV protection ── */
    function _update(address from, address to, uint256 amount)
        internal
        override
    {
        // Early return for zero amount transfers
        if (amount == 0) return;
        
        // Check pause state
        if (paused()) revert TokenPaused();
        
        // Check freeze state
        if (isFrozen[from]) revert Frozen(from);
        if (isFrozen[to]) revert Frozen(to);

        uint256 fee;
        bool isBuy;
        
        // Calculate tax if applicable
        if (!isExcluded[from] && !isExcluded[to]) {
            if (ammPairs[from]) {
                // Buy transaction - MEV protection
                if (block.number <= lastTaxedBlock[to] + TAX_COOLDOWN) {
                    revert CooldownActive();
                }
                fee = amount * buyTaxBps / BPS_DENOM;
                isBuy = true;
                lastTaxedBlock[to] = block.number;
            } else if (ammPairs[to]) {
                // Sell transaction - MEV protection
                if (block.number <= lastTaxedBlock[from] + TAX_COOLDOWN) {
                    revert CooldownActive();
                }
                fee = amount * sellTaxBps / BPS_DENOM;
                isBuy = false;
                lastTaxedBlock[from] = block.number;
            }
        }

        // Apply tax if any
        if (fee != 0) {
            // Update separate tax counters
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

    /* ── owner controls with DOS protection ── */
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
    
    function setAMMPairs(address[] calldata pairs, bool enabled) external onlyOwner {
        uint256 length = pairs.length;
        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
        
        for (uint256 i; i < length;) {
            address p = pairs[i];
            if (p == address(0)) revert ZeroAddress();
            ammPairs[p] = enabled;
            emit AMMPairUpdated(p, enabled);
            
            unchecked { ++i; }
        }
    }

    function setExclusion(address acct, bool excluded) external onlyOwner {
        isExcluded[acct] = excluded;
        emit ExclusionUpdated(acct, excluded);
    }
    
    function setExclusions(address[] calldata accts, bool excluded) external onlyOwner {
        uint256 length = accts.length;
        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
        
        for (uint256 i; i < length;) {
            isExcluded[accts[i]] = excluded;
            emit ExclusionUpdated(accts[i], excluded);
            
            unchecked { ++i; }
        }
    }

    function freeze(address acct, bool frozen) external onlyOwner {
        isFrozen[acct] = frozen;
        emit FreezeUpdated(acct, frozen);
    }
    
    function freezeBatch(address[] calldata accts, bool frozen) external onlyOwner {
        uint256 length = accts.length;
        if (length > MAX_BATCH_SIZE) revert BatchTooLarge();
        
        for (uint256 i; i < length;) {
            isFrozen[accts[i]] = frozen;
            emit FreezeUpdated(accts[i], frozen);
            
            unchecked { ++i; }
        }
    }

    function pause() external onlyOwner { 
        _pause(); 
    }
    
    function unpause() external onlyOwner { 
        _unpause(); 
    }

    /* ── rescue with SafeERC20 ── */
    function rescueERC20(address token, uint256 amt, address to) external onlyOwner {
        if (token == address(this)) revert CannotRescueYOM();
        if (to == address(0)) revert ZeroAddress();
        
        IERC20(token).safeTransfer(to, amt);
        emit RescueERC20(token, to, amt);
    }
    
    function rescueETH(address to, uint256 amt) external onlyOwner {
        if (to == address(0)) revert ZeroAddress();
        
        (bool ok, ) = to.call{value: amt}("");
        if (!ok) revert EthTransferFail();
        emit RescueETH(to, amt);
    }
    
    receive() external payable {}

    /* ── view helpers ── */
    function isAMMPair(address a) external view returns (bool) { 
        return ammPairs[a]; 
    }
    
    function isTaxExempt(address a) external view returns (bool) { 
        return isExcluded[a]; 
    }
    
    function isAccountFrozen(address a) external view returns (bool) { 
        return isFrozen[a]; 
    }
    
    function totalTaxCollected() external view returns (uint256) {
        return uint256(totalBuyTaxCollected) + uint256(totalSellTaxCollected);
    }
    
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