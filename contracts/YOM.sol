// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract YOM is ERC20, ERC20Burnable, ERC20Permit, ERC20Pausable, Ownable {
    constructor(address initialOwner)
        ERC20("YOM", "YOM")
        ERC20Permit("YOM")
        Ownable(initialOwner)
    {
        _mint(initialOwner, 300_000_000 * 10 ** decimals());
    }

    // Ensure compatibility between ERC20 and ERC20Pausable
    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Pausable)
    {
        super._update(from, to, value);
        emit Transfer(from, to, value); // Ensures the event is correctly emitted
    }

    // Allow only the owner to pause the contract
    function pause() public onlyOwner {
        _pause();
    }

    // Allow only the owner to unpause the contract
    function unpause() public onlyOwner {
        _unpause();
    }

    // Provide the option to renounce ownership for decentralization
    function renounceOwnership() public override onlyOwner {
        _transferOwnership(address(0));
    }
}