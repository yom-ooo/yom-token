// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract Factory {
    event ContractDeployed(address indexed newContract);

    /**
     * @dev Deploys a contract using CREATE2. The address where the contract will be deployed can be
     * precomputed by `computeAddress`.
     * @param salt The 32-byte salt used to determine the contract address.
     * @param bytecode The creation code of the contract you want to deploy.
     */
    function deploy(bytes32 salt, bytes memory bytecode) external returns (address) {
        address addr;
        assembly {
            addr := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
            if iszero(extcodesize(addr)) {
                revert(0, 0)
            }
        }
        emit ContractDeployed(addr);
        return addr;
    }

    /**
     * @dev Computes the address of the contract to be deployed using CREATE2 by this factory.
     * @param salt The 32-byte salt used to determine the contract address.
     * @param bytecode The creation code of the contract you want to deploy.
     */
    function computeAddress(bytes32 salt, bytes memory bytecode) public view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(bytecode)
            )
        );
        // Last 20 bytes of the hash -> address
        return address(uint160(uint256(hash)));
    }
}
