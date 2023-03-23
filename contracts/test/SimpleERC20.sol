// SPDX-License-Identifier:UNLICENSED
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract SimpleERC20 is ERC20 {

    constructor() ERC20("test", "test"){
    }

    function mint(address to, uint256 amount) public{
        _mint(to, amount);
    }
}
