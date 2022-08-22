const hre = require("hardhat");

async function main() {
  const Marketplace = await hre.ethers.getContractFactory(
    "BullieverseMarketPlace"
  );
  const deployedMarketplace = await Marketplace.deploy();

  await deployedMarketplace.deployed();

  console.log("Deployed Marketplace Address:", deployedMarketplace.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
