// SPDX-License-Identifier:UNLICENSED
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract TestNft is ERC721 {
    uint256 tokenId=1;

    constructor() ERC721("TestNft", "TestNft") {}

    function mintToken(address recipient) public {
        _safeMint(recipient, tokenId);
        tokenId++;
    }
}
