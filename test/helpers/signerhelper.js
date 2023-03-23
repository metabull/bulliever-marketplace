const generateDomainSeparator = (chainId, verifyingContract) => {
  return {
    name: "Bullieverse",
    version: "1",
    chainId,
    verifyingContract,
  };
};

const buyOrderTypes = {
  BuyOrder: [
    { name: "seller", type: "address" },
    { name: "contractAddress", type: "address" },
    { name: "tokenId", type: "uint256" },
    { name: "startTime", type: "uint256" },
    { name: "expiration", type: "uint256" },
    { name: "price", type: "uint256" },
    { name: "quantity", type: "uint256" },
    { name: "createdAtBlockNumber", type: "uint256" },
    { name: "paymentERC20", type: "address" },
  ],
};

const generateSignature = async ({
  chainId,
  verifyingContract,
  seller,
  contractAddress,
  tokenId,
  startTime,
  expiration,
  price,
  quantity,
  createdAtBlockNumber,
  paymentERC20,
  signer,
}) => {
  const domainSeparator = generateDomainSeparator(chainId, verifyingContract);
  const buyOrder = {
    seller,
    contractAddress,
    tokenId,
    startTime,
    expiration,
    price,
    quantity,
    createdAtBlockNumber,
    paymentERC20,
  };

  const signature = await signer._signTypedData(
    domainSeparator,
    buyOrderTypes,
    buyOrder
  );
  return signature;
};

module.exports = { generateSignature };
