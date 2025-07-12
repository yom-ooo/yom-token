// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @dev Minimal mock LayerZero endpoint for local testing
 */
contract MockEndpoint {
    mapping(address => address) public delegates;
    address public immutable endpoint;
    
    constructor() {
        endpoint = address(this);
    }
    
    function setDelegate(address _delegate) external {
        delegates[msg.sender] = _delegate;
    }
    
    // Add any other minimal functions YOM might need
    function send(
        uint32 _dstEid,
        bytes calldata _message,
        bytes calldata _options,
        address _refundAddress
    ) external payable {
        // Mock implementation - do nothing
    }
}