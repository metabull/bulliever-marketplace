const { expect } = require("chai");
const { ethers } = require("hardhat");
const { utils, BigNumber } = require("ethers");
const { generateSignature } = require("./helpers/signerhelper");

let totalTokenToBeDistributed = (200000000 * 10 ** 18).toLocaleString(
  "fullwide",
  {
    useGrouping: false,
  }
);

async function getCurrentTime() {
  const blockNumber = await ethers.provider.getBlockNumber();
  const block = await ethers.provider.getBlock(blockNumber);
  const timestamp = block.timestamp;
  return timestamp;
}

describe("NFTMarketPlace", function () {
  let marketplace;
  let testNFT;
  let erc20;
  let secondERC20;
  let cancellationRegistry;
  let exchangeRegistry;
  let paymentERC20Registry;
  let owner, addr1, maker;
  const initialBalance = utils.parseEther("10000");
  let simpleERC20Params = {
    name: "Tether",
    symbol: "USDT",
  };

  let secondERC20Params = {
    name: "USD Coin",
    symbol: "USDC",
  };

  beforeEach(async function () {
    [
      [owner, addr1, maker],
      marketplace,
      cancellationRegistry,
      paymentERC20Registry,
    ] = await Promise.all([
      ethers.getSigners(),
      (await ethers.getContractFactory("BullieverseMarketPlace")).deploy(),
      (await ethers.getContractFactory("CancellationRegistry")).deploy(),
      (await ethers.getContractFactory("PaymentERC20Registry")).deploy(),
    ]);

    await marketplace.setRegistryContracts(
      cancellationRegistry.address,
      paymentERC20Registry.address
    );
    await cancellationRegistry.addRegistrant(marketplace.address);
  });

  it("Change Owner of MarketPlace", async function () {
    let exchangeOwner = await marketplace.owner();
    expect(owner.address).equal(exchangeOwner);

    await marketplace.transferOwnership(addr1.address);
    exchangeOwner = await marketplace.owner();
    expect(addr1.address).equal(exchangeOwner);
  });

  describe("setRegistryContracts", function () {
    it("should set the cancellation registry", async function () {
      const cancellationRegistry = await ethers.getContractFactory(
        "CancellationRegistry"
      );

      const cancellationRegistryInstance = await cancellationRegistry.deploy();
      await marketplace.setRegistryContracts(
        cancellationRegistryInstance.address,
        ethers.constants.AddressZero
      );

      expect(await marketplace.cancellationRegistry()).to.equal(
        cancellationRegistryInstance.address
      );
    });

    it("should set the payment ERC20 registry", async function () {
      const paymentERC20Registry = await ethers.getContractFactory(
        "PaymentERC20Registry"
      );
      const paymentERC20RegistryInstance = await paymentERC20Registry.deploy();

      await marketplace.setRegistryContracts(
        ethers.constants.AddressZero,
        paymentERC20RegistryInstance.address
      );

      expect(await marketplace.paymentERC20Registry()).to.equal(
        paymentERC20RegistryInstance.address
      );
    });

    it("should revert if called by a non-owner", async function () {
      const [, account1] = await ethers.getSigners();

      await expect(
        marketplace
          .connect(account1)
          .setRegistryContracts(
            ethers.constants.AddressZero,
            ethers.constants.AddressZero
          )
      ).to.be.revertedWith("Ownable: caller is not the owner");
    });
  });

  describe("Fill Order With NFT", () => {
    let testNFTArtifacts;
    let testNFT;

    beforeEach(async () => {
      testNFTArtifacts = await ethers.getContractFactory("TestNft");
      testNFT = await testNFTArtifacts.deploy();
      await testNFT.deployed();
      await testNFT.mintToken(owner.address);
    });

    describe("NFT Fill Order", () => {
      const zeroAddress = ethers.constants.AddressZero;
      const price = "100000000";
      const tokenId = 1;
      const quantity = 1;
      describe("reverts", () => {
        it("reverts transaction if order is yet to start", async () => {
          const [currentTime, blockNumber, { chainId }, [owner]] =
            await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
              await ethers.getSigners(),
            ]);
          const signature = await generateSignature({
            chainId,
            verifyingContract: testNFT.address,
            seller: owner.address,
            contractAddress: marketplace.address,
            tokenId,
            startTime: Number(currentTime) + 100,
            expiration: Number(currentTime) + 100,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: zeroAddress,
            signer: owner,
          });

          await expect(
            marketplace.fillOrder(
              owner.address,
              testNFT.address,
              tokenId,
              Number(currentTime) + 3000,
              Number(currentTime) + 10000,
              price,
              quantity,
              blockNumber,
              ethers.constants.AddressZero,
              signature
            )
          ).to.be.revertedWith("Order is Yet To Start");
        });
        it("reverts transaction if order is already expired", async () => {
          const [currentTime, blockNumber, { chainId }, [owner]] =
            await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
              ethers.getSigners(),
            ]);

          const signature = await generateSignature({
            chainId,
            verifyingContract: testNFT.address,
            seller: owner.address,
            contractAddress: marketplace.address,
            tokenId,
            startTime: Number(currentTime) - 10000,
            expiration: Number(currentTime) - 30,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: ethers.constants.AddressZero,
            signer: owner,
          });

          await expect(
            marketplace.fillOrder(
              owner.address,
              testNFT.address,
              tokenId,
              Number(currentTime) - 10000,
              Number(currentTime) - 30,
              price,
              quantity,
              blockNumber,
              ethers.constants.AddressZero,
              signature
            )
          ).to.be.revertedWith("Order is Expired");
        });
        it("reverts transaction if eth amount isn't enough", async () => {
          const [currentTime, blockNumber, { chainId }, [owner]] =
            await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
              ethers.getSigners(),
            ]);

          const signature = await generateSignature({
            chainId,
            verifyingContract: testNFT.address,
            seller: owner.address,
            contractAddress: marketplace.address,
            tokenId,
            startTime: Number(currentTime) - 10000,
            expiration: Number(currentTime) + 3000,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: ethers.constants.AddressZero,
            signer: owner,
          });

          await expect(
            marketplace.fillOrder(
              owner.address,
              testNFT.address,
              tokenId,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000,
              price,
              quantity,
              blockNumber,
              ethers.constants.AddressZero,
              signature
            )
          ).to.be.revertedWith(
            "Transaction doesn't have the required ETH amount."
          );
        });
        it("reverts transaction if signature is wrong", async () => {
          const [currentTime, blockNumber, { chainId }, [owner]] =
            await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
              ethers.getSigners(),
            ]);

          const signature = await generateSignature({
            chainId,
            verifyingContract: testNFT.address,
            seller: owner.address,
            contractAddress: marketplace.address,
            tokenId,
            startTime: Number(currentTime) - 10000,
            expiration: Number(currentTime) + 3000,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: ethers.constants.AddressZero,
            signer: owner,
          });

          await expect(
            marketplace.fillOrder(
              owner.address,
              testNFT.address,
              tokenId,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000,
              price,
              quantity,
              blockNumber,
              ethers.constants.AddressZero,
              signature,
              { value: "100000000" }
            )
          ).to.be.revertedWith("Signature is not valid for BuyOrder.");
        });
        it("reverts transaction if allowance isn't given to marketplace contract", async () => {
          const [currentTime, blockNumber, { chainId }, [owner]] =
            await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
              ethers.getSigners(),
            ]);

          const signature = await generateSignature({
            chainId,
            verifyingContract: marketplace.address,
            seller: owner.address,
            contractAddress: testNFT.address,
            tokenId,
            startTime: Number(currentTime) - 10000,
            expiration: Number(currentTime) + 3000,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: ethers.constants.AddressZero,
            signer: owner,
          });

          await expect(
            marketplace.fillOrder(
              owner.address,
              testNFT.address,
              tokenId,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000,
              price,
              quantity,
              blockNumber,
              ethers.constants.AddressZero,
              signature,
              { value: price }
            )
          ).to.be.revertedWith(
            "The Exchange is not approved to operate this NFT"
          );
        });
        it("reverts transaction if user tries to buy cancelled order", async () => {
          const [currentTime, blockNumber, { chainId }, [owner]] =
            await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
              ethers.getSigners(),
            ]);

          const signature = await generateSignature({
            chainId,
            verifyingContract: marketplace.address,
            seller: owner.address,
            contractAddress: testNFT.address,
            tokenId,
            startTime: Number(currentTime) - 10000,
            expiration: Number(currentTime) + 3000,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: ethers.constants.AddressZero,
            signer: owner,
          });

          await marketplace.cancelAllPreviousListing(testNFT.address, 1);

          await expect(
            marketplace.fillOrder(
              owner.address,
              testNFT.address,
              tokenId,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000,
              price,
              quantity,
              blockNumber,
              ethers.constants.AddressZero,
              signature,
              { value: price }
            )
          ).to.be.revertedWith("This order has been cancelled.");
        });
        it("reverts transaction if user tries buy to sold order", async () => {
          const [
            currentTime,
            blockNumber,
            { chainId },
            [owner, secondAccount],
          ] = await Promise.all([
            getCurrentTime(),
            ethers.provider.getBlockNumber(),
            ethers.provider.getNetwork(),
            ethers.getSigners(),
          ]);

          const signature = await generateSignature({
            chainId,
            verifyingContract: marketplace.address,
            seller: owner.address,
            contractAddress: testNFT.address,
            tokenId,
            startTime: Number(currentTime) - 10000,
            expiration: Number(currentTime) + 3000,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: "0x0000000000000000000000000000000000000000",
            signer: owner,
          });

          await testNFT.setApprovalForAll(marketplace.address, true);
          testNFT.mintToken();

          const ethBalaceBeforeSale = await owner.getBalance();

          expect(await testNFT.ownerOf(1)).to.equal(owner.address);

          await expect(
            marketplace
              .connect(secondAccount)
              .fillOrder(
                owner.address,
                testNFT.address,
                tokenId,
                Number(currentTime) - 10000,
                Number(currentTime) + 3000,
                price,
                quantity,
                blockNumber,
                ethers.constants.AddressZero,
                signature,
                { value: price }
              )
          )
            .to.emit(marketplace, "BuyOrderFilled")
            .withArgs(
              owner.address,
              secondAccount.address,
              testNFT.address,
              1,
              price,
              blockNumber,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000
            );
          const ethBalaceAfterSale = await owner.getBalance();

          expect(ethBalaceBeforeSale.add(price)).to.equal(ethBalaceAfterSale);
          expect(await testNFT.ownerOf(1)).to.equal(secondAccount.address);
          await expect(
            marketplace
              .connect(secondAccount)
              .fillOrder(
                owner.address,
                testNFT.address,
                tokenId,
                Number(currentTime) - 10000,
                Number(currentTime) + 3000,
                price,
                quantity,
                blockNumber,
                ethers.constants.AddressZero,
                signature,
                { value: price }
              )
          ).to.revertedWith("This order has been cancelled");
        });
      });
      it("should transfer the eth from the buyer's address to the seller's address upon successful order fulfillment", async () => {
        const [currentTime, blockNumber, { chainId }, [owner, secondAccount]] =
          await Promise.all([
            getCurrentTime(),
            ethers.provider.getBlockNumber(),
            ethers.provider.getNetwork(),
            ethers.getSigners(),
          ]);

        const signature = await generateSignature({
          chainId,
          verifyingContract: marketplace.address,
          seller: owner.address,
          contractAddress: testNFT.address,
          tokenId,
          startTime: Number(currentTime) - 10000,
          expiration: Number(currentTime) + 3000,
          price,
          quantity,
          createdAtBlockNumber: blockNumber,
          paymentERC20: zeroAddress,
          signer: owner,
        });

        await testNFT.setApprovalForAll(marketplace.address, true);
        testNFT.mintToken();

        const ethBalaceBeforeSale = await owner.getBalance();

        expect(await testNFT.ownerOf(1)).to.equal(owner.address);

        await expect(
          marketplace
            .connect(secondAccount)
            .fillOrder(
              owner.address,
              testNFT.address,
              tokenId,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000,
              price,
              quantity,
              blockNumber,
              ethers.constants.AddressZero,
              signature,
              { value: price }
            )
        )
          .to.emit(marketplace, "BuyOrderFilled")
          .withArgs(
            owner.address,
            secondAccount.address,
            testNFT.address,
            1,
            price,
            blockNumber,
            Number(currentTime) - 10000,
            Number(currentTime) + 3000
          );
        const ethBalaceAfterSale = await owner.getBalance();

        expect(ethBalaceBeforeSale.add(price)).to.equal(ethBalaceAfterSale);
        expect(await testNFT.ownerOf(1)).to.equal(secondAccount.address);
      });
      it("Should correctly transfer eth from buyer address to seller address upon order fulfillment, while also transferring the correct amounts to the platform and maker wallets based on their set percentages", async () => {
        const [
          currentTime,
          blockNumber,
          { chainId },
          [owner, secondAccount, makerWallet, platformWallet],
        ] = await Promise.all([
          getCurrentTime(),
          ethers.provider.getBlockNumber(),
          ethers.provider.getNetwork(),
          ethers.getSigners(),
        ]);

        const signature = await generateSignature({
          chainId,
          verifyingContract: marketplace.address,
          seller: owner.address,
          contractAddress: testNFT.address,
          tokenId,
          startTime: Number(currentTime) - 10000,
          expiration: Number(currentTime) + 3000,
          price,
          quantity,
          createdAtBlockNumber: blockNumber,
          paymentERC20: "0x0000000000000000000000000000000000000000",
          signer: owner,
        });

        await Promise.all([
          marketplace.setPlatFormPercentage(250),
          marketplace.setCreaterPercentage(250),
          marketplace.setMakerWallet(makerWallet.address),
          marketplace.setPlatFormWallet(platformWallet.address),
        ]);

        await testNFT.setApprovalForAll(marketplace.address, true);
        testNFT.mintToken();

        const [
          ethBalaceOfNFTSaleBeforeSale,
          ethBalanceOfMakerWalletBeforeSale,
          ethBalaceOfPlatformrWalletBeforeSale,
        ] = await Promise.all([
          owner.getBalance(),
          makerWallet.getBalance(),
          platformWallet.getBalance(),
        ]);

        expect(await testNFT.ownerOf(1)).to.equal(owner.address);

        await expect(
          marketplace
            .connect(secondAccount)
            .fillOrder(
              owner.address,
              testNFT.address,
              tokenId,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000,
              price,
              quantity,
              blockNumber,
              ethers.constants.AddressZero,
              signature,
              { value: price }
            )
        )
          .to.emit(marketplace, "BuyOrderFilled")
          .withArgs(
            owner.address,
            secondAccount.address,
            testNFT.address,
            tokenId,
            price,
            blockNumber,
            Number(currentTime) - 10000,
            Number(currentTime) + 3000
          );
        const [
          ethBalaceOfNFTSaleAfterSale,
          ethBalanceOfMakerWalletAfterSale,
          ethBalanceOfPlatformWallet,
        ] = await Promise.all([
          owner.getBalance(),
          makerWallet.getBalance(),
          platformWallet.getBalance(),
        ]);

        const forMakerWallet = BigNumber.from(price).mul(250).div(10000);

        expect(
          ethBalaceOfNFTSaleBeforeSale.add(price).sub(forMakerWallet.mul(2))
        ).to.equal(ethBalaceOfNFTSaleAfterSale);
        expect(
          ethBalaceOfPlatformrWalletBeforeSale.add(forMakerWallet)
        ).to.equal(ethBalanceOfPlatformWallet);
        expect(ethBalanceOfMakerWalletBeforeSale.add(forMakerWallet)).to.equal(
          ethBalanceOfMakerWalletAfterSale
        );
        expect(await testNFT.ownerOf(1)).to.equal(secondAccount.address);
      });
      describe("NFT Fill Order With ERC20 Token", () => {
        let erc20Token;
        const price = "100000000";
        const tokenId = 1;
        const quantity = 1;
        beforeEach(async () => {
          erc20Token = await (
            await ethers.getContractFactory("SimpleERC20")
          ).deploy();
        });
        describe("reverts", () => {
          it("reverts transaction if non-approved is used", async () => {
            const [
              currentTime,
              blockNumber,
              { chainId },
              [owner, secondAccount],
            ] = await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
              ethers.getSigners(),
            ]);

            const signature = await generateSignature({
              chainId,
              verifyingContract: marketplace.address,
              seller: owner.address,
              contractAddress: testNFT.address,
              tokenId,
              startTime: Number(currentTime) - 10000,
              expiration: Number(currentTime) + 3000,
              price,
              quantity,
              createdAtBlockNumber: blockNumber,
              paymentERC20: erc20Token.address,
              signer: owner,
            });

            await testNFT.setApprovalForAll(marketplace.address, true);
            testNFT.mintToken();

            await erc20Token
              .connect(secondAccount)
              .approve(marketplace.address, "10000000000000000000000000000000");
            await erc20Token.mint(
              secondAccount.address,
              "1000000000000000000000000000000000000000000"
            );

            expect(await testNFT.ownerOf(1)).to.equal(owner.address);

            await expect(
              marketplace
                .connect(secondAccount)
                .fillOrder(
                  owner.address,
                  testNFT.address,
                  tokenId,
                  Number(currentTime) - 10000,
                  Number(currentTime) + 3000,
                  price,
                  quantity,
                  blockNumber,
                  erc20Token.address,
                  signature
                )
            ).to.revertedWith("Payment ERC20 is not approved.");
          });
          it("reverts transaction if user doesn't have sufficient balance", async () => {
            const [
              currentTime,
              blockNumber,
              { chainId },
              [owner, secondAccount],
            ] = await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
              ethers.getSigners(),
              paymentERC20Registry.addApprovedERC20(erc20Token.address),
            ]);

            const signature = await generateSignature({
              chainId,
              verifyingContract: marketplace.address,
              seller: owner.address,
              contractAddress: testNFT.address,
              tokenId,
              startTime: Number(currentTime) - 10000,
              expiration: Number(currentTime) + 3000,
              price,
              quantity,
              createdAtBlockNumber: blockNumber,
              paymentERC20: erc20Token.address,
              signer: owner,
            });

            await testNFT.setApprovalForAll(marketplace.address, true);
            testNFT.mintToken();

            await erc20Token
              .connect(secondAccount)
              .approve(marketplace.address, "10000000000000000000000000000000");

            expect(await testNFT.ownerOf(1)).to.equal(owner.address);

            await expect(
              marketplace
                .connect(secondAccount)
                .fillOrder(
                  owner.address,
                  testNFT.address,
                  tokenId,
                  Number(currentTime) - 10000,
                  Number(currentTime) + 3000,
                  price,
                  quantity,
                  blockNumber,
                  erc20Token.address,
                  signature
                )
            ).to.revertedWith("Buyer's balance is insufficient");
          });
          it("reverts transaction if user doesn't have sufficient allowance", async () => {
            const [owner, secondAccount] = await ethers.getSigners();
            const [currentTime, blockNumber, { chainId }] = await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
              paymentERC20Registry.addApprovedERC20(erc20Token.address),
            ]);

            const signature = await generateSignature({
              chainId,
              verifyingContract: marketplace.address,
              seller: owner.address,
              contractAddress: testNFT.address,
              tokenId,
              startTime: Number(currentTime) - 10000,
              expiration: Number(currentTime) + 3000,
              price,
              quantity,
              createdAtBlockNumber: blockNumber,
              paymentERC20: erc20Token.address,
              signer: owner,
            });

            await testNFT.setApprovalForAll(marketplace.address, true);
            testNFT.mintToken();
            await erc20Token.mint(
              secondAccount.address,
              "1000000000000000000000000000000000000000000"
            );

            expect(await testNFT.ownerOf(1)).to.equal(owner.address);

            await expect(
              marketplace
                .connect(secondAccount)
                .fillOrder(
                  owner.address,
                  testNFT.address,
                  tokenId,
                  Number(currentTime) - 10000,
                  Number(currentTime) + 3000,
                  price,
                  quantity,
                  blockNumber,
                  erc20Token.address,
                  signature
                )
            ).to.revertedWith(
              "Exchange is not approved to handle a sufficient amount of the ERC20."
            );
          });
        });
        it("should transfer the specified token from the buyer's address to the seller's address upon successful order fulfillment", async () => {
          const [owner, secondAccount] = await ethers.getSigners();

          const [currentTime, blockNumber, { chainId }] = await Promise.all([
            getCurrentTime(),
            ethers.provider.getBlockNumber(),
            ethers.provider.getNetwork(),
            paymentERC20Registry.addApprovedERC20(erc20Token.address),
          ]);

          const signature = await generateSignature({
            chainId,
            verifyingContract: marketplace.address,
            seller: owner.address,
            contractAddress: testNFT.address,
            tokenId,
            startTime: Number(currentTime) - 10000,
            expiration: Number(currentTime) + 3000,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: erc20Token.address,
            signer: owner,
          });

          await testNFT.setApprovalForAll(marketplace.address, true);
          testNFT.mintToken();

          await erc20Token
            .connect(secondAccount)
            .approve(marketplace.address, "10000000000000000000000000000000");
          await erc20Token.mint(
            secondAccount.address,
            "1000000000000000000000000000000000000000000"
          );

          expect(await testNFT.ownerOf(1)).to.equal(owner.address);

          const [balanceOfBuyerWallet, balanceOfSellerAccount] =
            await Promise.all([
              erc20Token.balanceOf(secondAccount.address),
              erc20Token.balanceOf(owner.address),
            ]);

          await expect(
            marketplace
              .connect(secondAccount)
              .fillOrder(
                owner.address,
                testNFT.address,
                tokenId,
                Number(currentTime) - 10000,
                Number(currentTime) + 3000,
                price,
                quantity,
                blockNumber,
                erc20Token.address,
                signature
              )
          )
            .to.emit(marketplace, "BuyOrderFilled")
            .withArgs(
              owner.address,
              secondAccount.address,
              testNFT.address,
              1,
              price,
              blockNumber,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000
            );
          const [
            balanceAfterSaleOfBuyerWallet,
            balanceAfterSaleOfSellerAccount,
          ] = await Promise.all([
            erc20Token.balanceOf(secondAccount.address),
            erc20Token.balanceOf(owner.address),
          ]);
          expect(balanceAfterSaleOfBuyerWallet).to.be.equal(
            balanceOfBuyerWallet.sub(price)
          );
          expect(balanceAfterSaleOfSellerAccount).to.be.equal(
            balanceOfSellerAccount.add(BigNumber.from(price))
          );
        });
        it("Should correctly transfer erc20 token from buyer address to seller address upon order fulfillment, while also transferring the correct amounts to the platform and maker wallets based on their set percentages", async () => {
          const [owner, secondAccount, makerWallet, platformWallet] =
            await ethers.getSigners();
          const [currentTime, blockNumber, { chainId }] = await Promise.all([
            getCurrentTime(),
            ethers.provider.getBlockNumber(),
            ethers.provider.getNetwork(),
            paymentERC20Registry.addApprovedERC20(erc20Token.address),
          ]);

          const signature = await generateSignature({
            chainId,
            verifyingContract: marketplace.address,
            seller: owner.address,
            contractAddress: testNFT.address,
            tokenId,
            startTime: Number(currentTime) - 10000,
            expiration: Number(currentTime) + 3000,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: erc20Token.address,
            signer: owner,
          });

          await Promise.all([
            marketplace.setPlatFormPercentage(250),
            marketplace.setCreaterPercentage(350),
            marketplace.setMakerWallet(makerWallet.address),
            marketplace.setPlatFormWallet(platformWallet.address),
          ]);

          await testNFT.setApprovalForAll(marketplace.address, true);
          testNFT.mintToken();
          await erc20Token
            .connect(secondAccount)
            .approve(marketplace.address, "10000000000000000000000000000000");
          await erc20Token.mint(
            secondAccount.address,
            "1000000000000000000000000000000000000000000"
          );

          expect(await testNFT.ownerOf(1)).to.equal(owner.address);

          const [
            balanceOfBuyerWallet,
            balanceOfSellerAccount,
            balaceOfMakerWallet,
            balanceOfPlatformWallet,
          ] = await Promise.all([
            erc20Token.balanceOf(secondAccount.address),
            erc20Token.balanceOf(owner.address),
            erc20Token.balanceOf(makerWallet.address),
            erc20Token.balanceOf(platformWallet.address),
          ]);

          await expect(
            marketplace
              .connect(secondAccount)
              .fillOrder(
                owner.address,
                testNFT.address,
                tokenId,
                Number(currentTime) - 10000,
                Number(currentTime) + 3000,
                price,
                quantity,
                blockNumber,
                erc20Token.address,
                signature
              )
          )
            .to.emit(marketplace, "BuyOrderFilled")
            .withArgs(
              owner.address,
              secondAccount.address,
              testNFT.address,
              tokenId,
              price,
              blockNumber,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000
            );
          const [
            balanceAfterSaleOfBuyerWallet,
            balanceAfterSaleOfSellerAccount,
            balanceAfterSaleOfMakerWallet,
            balanceAfterSaleOfPlatformWallet,
          ] = await Promise.all([
            erc20Token.balanceOf(secondAccount.address),
            erc20Token.balanceOf(owner.address),
            erc20Token.balanceOf(makerWallet.address),
            erc20Token.balanceOf(platformWallet.address),
          ]);

          const forPlatformWallet = BigNumber.from(price).mul(250).div(10000);
          const forMakerWallet = BigNumber.from(price).mul(350).div(10000);

          expect(balanceAfterSaleOfBuyerWallet).to.be.equal(
            balanceOfBuyerWallet.sub(price)
          );
          expect(balanceAfterSaleOfSellerAccount).to.be.equal(
            balanceOfSellerAccount.add(
              BigNumber.from(price).sub(forMakerWallet).sub(forPlatformWallet)
            )
          );
          expect(balanceAfterSaleOfMakerWallet).to.be.equal(
            balaceOfMakerWallet.add(forMakerWallet)
          );
          expect(balanceAfterSaleOfPlatformWallet).to.be.equal(
            balanceOfPlatformWallet.add(forPlatformWallet)
          );
        });
      });
    });
  });
  describe("Fill Order With ERC1155", () => {
    let testERC1155;

    beforeEach(async () => {
      testERC1155 = await (
        await ethers.getContractFactory("BullieverseAssets")
      ).deploy();
      await testERC1155.mintAsset(1, 1);
    });

    describe("NFT Fill Order", () => {
      const zeroAddress = ethers.constants.AddressZero;
      const price = "100000000";
      const tokenId = 1;
      const quantity = 1;
      describe("reverts", () => {
        it("reverts transaction if order is yet to start", async () => {
          const [currentTime, blockNumber, { chainId }, [owner]] =
            await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
              await ethers.getSigners(),
            ]);
          const signature = await generateSignature({
            chainId,
            verifyingContract: testERC1155.address,
            seller: owner.address,
            contractAddress: marketplace.address,
            tokenId,
            startTime: Number(currentTime) + 100,
            expiration: Number(currentTime) + 100,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: zeroAddress,
            signer: owner,
          });

          await expect(
            marketplace.fillOrder(
              owner.address,
              testERC1155.address,
              tokenId,
              Number(currentTime) + 3000,
              Number(currentTime) + 10000,
              price,
              quantity,
              blockNumber,
              ethers.constants.AddressZero,
              signature
            )
          ).to.be.revertedWith("Order is Yet To Start");
        });

        it("reverts transaction if order is already expired", async () => {
          const [currentTime, blockNumber, { chainId }, [owner]] =
            await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
              ethers.getSigners(),
            ]);

          const signature = await generateSignature({
            chainId,
            verifyingContract: testERC1155.address,
            seller: owner.address,
            contractAddress: marketplace.address,
            tokenId,
            startTime: Number(currentTime) - 10000,
            expiration: Number(currentTime) - 30,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: ethers.constants.AddressZero,
            signer: owner,
          });

          await expect(
            marketplace.fillOrder(
              owner.address,
              testERC1155.address,
              tokenId,
              Number(currentTime) - 10000,
              Number(currentTime) - 30,
              price,
              quantity,
              blockNumber,
              ethers.constants.AddressZero,
              signature
            )
          ).to.be.revertedWith("Order is Expired");
        });
        it("reverts transaction if eth amount isn't enough", async () => {
          const [currentTime, blockNumber, { chainId }, [owner]] =
            await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
              ethers.getSigners(),
            ]);

          const signature = await generateSignature({
            chainId,
            verifyingContract: testERC1155.address,
            seller: owner.address,
            contractAddress: marketplace.address,
            tokenId,
            startTime: Number(currentTime) - 10000,
            expiration: Number(currentTime) + 3000,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: ethers.constants.AddressZero,
            signer: owner,
          });

          await expect(
            marketplace.fillOrder(
              owner.address,
              testERC1155.address,
              tokenId,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000,
              price,
              quantity,
              blockNumber,
              ethers.constants.AddressZero,
              signature
            )
          ).to.be.revertedWith(
            "Transaction doesn't have the required ETH amount."
          );
        });

        it("reverts transaction if signature is wrong", async () => {
          const [currentTime, blockNumber, { chainId }, [owner]] =
            await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
              ethers.getSigners(),
            ]);

          const signature = await generateSignature({
            chainId,
            verifyingContract: marketplace.address,
            seller: owner.address,
            contractAddress: testERC1155.address,
            tokenId,
            startTime: Number(currentTime) - 10000,
            expiration: Number(currentTime) + 3001,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: ethers.constants.AddressZero,
            signer: owner,
          });

          await expect(
            marketplace.fillOrder(
              owner.address,
              testERC1155.address,
              tokenId,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000,
              price,
              quantity,
              blockNumber,
              ethers.constants.AddressZero,
              signature,
              { value: "100000000" }
            )
          ).to.be.revertedWith("Signature is not valid for BuyOrder.");
        });
        it("reverts transaction if allowance isn't given to marketplace contract", async () => {
          const [currentTime, blockNumber, { chainId }, [owner]] =
            await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
              ethers.getSigners(),
            ]);

          const signature = await generateSignature({
            chainId,
            verifyingContract: marketplace.address,
            seller: owner.address,
            contractAddress: testERC1155.address,
            tokenId,
            startTime: Number(currentTime) - 10000,
            expiration: Number(currentTime) + 3000,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: ethers.constants.AddressZero,
            signer: owner,
          });

          await expect(
            marketplace.fillOrder(
              owner.address,
              testERC1155.address,
              tokenId,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000,
              price,
              quantity,
              blockNumber,
              ethers.constants.AddressZero,
              signature,
              { value: price }
            )
          ).to.be.revertedWith("ERC1155: caller is not owner nor approved");
        });
        it("reverts transaction if user tries to buy cancelled order", async () => {
          const [currentTime, blockNumber, { chainId }, [owner]] =
            await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
              ethers.getSigners(),
            ]);

          const signature = await generateSignature({
            chainId,
            verifyingContract: marketplace.address,
            seller: owner.address,
            contractAddress: testERC1155.address,
            tokenId,
            startTime: Number(currentTime) - 10000,
            expiration: Number(currentTime) + 3000,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: ethers.constants.AddressZero,
            signer: owner,
          });

          await marketplace.cancelAllPreviousListing(testERC1155.address, 1);

          await expect(
            marketplace.fillOrder(
              owner.address,
              testERC1155.address,
              tokenId,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000,
              price,
              quantity,
              blockNumber,
              ethers.constants.AddressZero,
              signature,
              { value: price }
            )
          ).to.be.revertedWith("This order has been cancelled.");
        });
        it("reverts transaction if user tries to buy sold order", async () => {
          const [
            currentTime,
            blockNumber,
            { chainId },
            [owner, secondAccount],
          ] = await Promise.all([
            getCurrentTime(),
            ethers.provider.getBlockNumber(),
            ethers.provider.getNetwork(),
            ethers.getSigners(),
          ]);

          const signature = await generateSignature({
            chainId,
            verifyingContract: marketplace.address,
            seller: owner.address,
            contractAddress: testERC1155.address,
            tokenId,
            startTime: Number(currentTime) - 10000,
            expiration: Number(currentTime) + 3000,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: "0x0000000000000000000000000000000000000000",
            signer: owner,
          });

          await testERC1155.setApprovalForAll(marketplace.address, true);

          await expect(
            marketplace
              .connect(secondAccount)
              .fillOrder(
                owner.address,
                testERC1155.address,
                tokenId,
                Number(currentTime) - 10000,
                Number(currentTime) + 3000,
                price,
                quantity,
                blockNumber,
                ethers.constants.AddressZero,
                signature,
                { value: price }
              )
          )
            .to.emit(marketplace, "BuyOrderFilled")
            .withArgs(
              owner.address,
              secondAccount.address,
              testERC1155.address,
              1,
              price,
              blockNumber,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000
            );

          await expect(
            marketplace
              .connect(secondAccount)
              .fillOrder(
                owner.address,
                testERC1155.address,
                tokenId,
                Number(currentTime) - 10000,
                Number(currentTime) + 3000,
                price,
                quantity,
                blockNumber,
                ethers.constants.AddressZero,
                signature,
                { value: price }
              )
          ).to.revertedWith("This order has been cancelled");
        });
      });
      it("should correctly transfer eth from buyer address to seller address upon order fullfillment", async () => {
        const [currentTime, blockNumber, { chainId }, [owner, secondAccount]] =
          await Promise.all([
            getCurrentTime(),
            ethers.provider.getBlockNumber(),
            ethers.provider.getNetwork(),
            ethers.getSigners(),
          ]);

        const signature = await generateSignature({
          chainId,
          verifyingContract: marketplace.address,
          seller: owner.address,
          contractAddress: testERC1155.address,
          tokenId,
          startTime: Number(currentTime) - 10000,
          expiration: Number(currentTime) + 3000,
          price,
          quantity,
          createdAtBlockNumber: blockNumber,
          paymentERC20: zeroAddress,
          signer: owner,
        });

        await testERC1155.setApprovalForAll(marketplace.address, true);

        const ethBalaceBeforeSale = await owner.getBalance();

        await expect(
          marketplace
            .connect(secondAccount)
            .fillOrder(
              owner.address,
              testERC1155.address,
              tokenId,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000,
              price,
              quantity,
              blockNumber,
              ethers.constants.AddressZero,
              signature,
              { value: price }
            )
        )
          .to.emit(marketplace, "BuyOrderFilled")
          .withArgs(
            owner.address,
            secondAccount.address,
            testERC1155.address,
            1,
            price,
            blockNumber,
            Number(currentTime) - 10000,
            Number(currentTime) + 3000
          );
        const ethBalaceAfterSale = await owner.getBalance();

        expect(ethBalaceBeforeSale.add(price)).to.equal(ethBalaceAfterSale);
      });

      it("Should correctly transfer eth from buyer address to seller address upon order fulfillment, while also transferring the correct amounts to the platform and maker wallets based on their set percentages", async () => {
        const [
          currentTime,
          blockNumber,
          { chainId },
          [owner, secondAccount, makerWallet, platformWallet],
        ] = await Promise.all([
          getCurrentTime(),
          ethers.provider.getBlockNumber(),
          ethers.provider.getNetwork(),
          ethers.getSigners(),
        ]);

        const signature = await generateSignature({
          chainId,
          verifyingContract: marketplace.address,
          seller: owner.address,
          contractAddress: testERC1155.address,
          tokenId,
          startTime: Number(currentTime) - 10000,
          expiration: Number(currentTime) + 3000,
          price,
          quantity,
          createdAtBlockNumber: blockNumber,
          paymentERC20: "0x0000000000000000000000000000000000000000",
          signer: owner,
        });

        await Promise.all([
          marketplace.setPlatFormPercentage(250),
          marketplace.setCreaterPercentage(250),
          marketplace.setMakerWallet(makerWallet.address),
          marketplace.setPlatFormWallet(platformWallet.address),
        ]);

        await testERC1155.setApprovalForAll(marketplace.address, true);

        const [
          ethBalaceOfNFTSaleBeforeSale,
          ethBalanceOfMakerWalletBeforeSale,
          ethBalaceOfPlatformrWalletBeforeSale,
        ] = await Promise.all([
          owner.getBalance(),
          makerWallet.getBalance(),
          platformWallet.getBalance(),
        ]);

        await expect(
          marketplace
            .connect(secondAccount)
            .fillOrder(
              owner.address,
              testERC1155.address,
              tokenId,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000,
              price,
              quantity,
              blockNumber,
              ethers.constants.AddressZero,
              signature,
              { value: price }
            )
        )
          .to.emit(marketplace, "BuyOrderFilled")
          .withArgs(
            owner.address,
            secondAccount.address,
            testERC1155.address,
            tokenId,
            price,
            blockNumber,
            Number(currentTime) - 10000,
            Number(currentTime) + 3000
          );
        const [
          ethBalaceOfNFTSaleAfterSale,
          ethBalanceOfMakerWalletAfterSale,
          ethBalanceOfPlatformWallet,
        ] = await Promise.all([
          owner.getBalance(),
          makerWallet.getBalance(),
          platformWallet.getBalance(),
        ]);

        const forMakerWallet = BigNumber.from(price).mul(250).div(10000);

        expect(
          ethBalaceOfNFTSaleBeforeSale.add(price).sub(forMakerWallet.mul(2))
        ).to.equal(ethBalaceOfNFTSaleAfterSale);
        expect(
          ethBalaceOfPlatformrWalletBeforeSale.add(forMakerWallet)
        ).to.equal(ethBalanceOfPlatformWallet);
        expect(ethBalanceOfMakerWalletBeforeSale.add(forMakerWallet)).to.equal(
          ethBalanceOfMakerWalletAfterSale
        );
      });
      describe("NFT Fill Order With ERC20 Token", () => {
        let erc20Token;
        const price = "100000000";
        const tokenId = 1;
        const quantity = 1;
        beforeEach(async () => {
          erc20Token = await (
            await ethers.getContractFactory("SimpleERC20")
          ).deploy();
        });
        describe("reverts", () => {
          it("reverts transaction if non-approved is used", async () => {
            const [owner, secondAccount] = await ethers.getSigners();
            const [currentTime, blockNumber, { chainId }] = await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
            ]);

            const signature = await generateSignature({
              chainId,
              verifyingContract: marketplace.address,
              seller: owner.address,
              contractAddress: testERC1155.address,
              tokenId,
              startTime: Number(currentTime) - 10000,
              expiration: Number(currentTime) + 3000,
              price,
              quantity,
              createdAtBlockNumber: blockNumber,
              paymentERC20: erc20Token.address,
              signer: owner,
            });

            await testERC1155.setApprovalForAll(marketplace.address, true);

            await erc20Token
              .connect(secondAccount)
              .approve(marketplace.address, "10000000000000000000000000000000");
            await erc20Token.mint(
              secondAccount.address,
              "1000000000000000000000000000000000000000000"
            );

            await expect(
              marketplace
                .connect(secondAccount)
                .fillOrder(
                  owner.address,
                  testERC1155.address,
                  tokenId,
                  Number(currentTime) - 10000,
                  Number(currentTime) + 3000,
                  price,
                  quantity,
                  blockNumber,
                  erc20Token.address,
                  signature
                )
            ).to.revertedWith("Payment ERC20 is not approved.");
          });
          it("reverts transaction if user doesn't have erc20 sufficient balance", async () => {
            const [owner, secondAccount] = await ethers.getSigners();
            const [currentTime, blockNumber, { chainId }] = await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
              paymentERC20Registry.addApprovedERC20(erc20Token.address),
            ]);

            const signature = await generateSignature({
              chainId,
              verifyingContract: marketplace.address,
              seller: owner.address,
              contractAddress: testERC1155.address,
              tokenId,
              startTime: Number(currentTime) - 10000,
              expiration: Number(currentTime) + 3000,
              price,
              quantity,
              createdAtBlockNumber: blockNumber,
              paymentERC20: erc20Token.address,
              signer: owner,
            });

            await testERC1155.setApprovalForAll(marketplace.address, true);

            await erc20Token
              .connect(secondAccount)
              .approve(marketplace.address, "10000000000000000000000000000000");

            await expect(
              marketplace
                .connect(secondAccount)
                .fillOrder(
                  owner.address,
                  testERC1155.address,
                  tokenId,
                  Number(currentTime) - 10000,
                  Number(currentTime) + 3000,
                  price,
                  quantity,
                  blockNumber,
                  erc20Token.address,
                  signature
                )
            ).to.revertedWith("Buyer's balance is insufficient");
          });
          it("reverts transaction if user doesn't have erc20 sufficient allowance", async () => {
            const [owner, secondAccount] = await ethers.getSigners();
            const [currentTime, blockNumber, { chainId }] = await Promise.all([
              getCurrentTime(),
              ethers.provider.getBlockNumber(),
              ethers.provider.getNetwork(),
              paymentERC20Registry.addApprovedERC20(erc20Token.address),
            ]);

            const signature = await generateSignature({
              chainId,
              verifyingContract: marketplace.address,
              seller: owner.address,
              contractAddress: testERC1155.address,
              tokenId,
              startTime: Number(currentTime) - 10000,
              expiration: Number(currentTime) + 3000,
              price,
              quantity,
              createdAtBlockNumber: blockNumber,
              paymentERC20: erc20Token.address,
              signer: owner,
            });

            await testERC1155.setApprovalForAll(marketplace.address, true);

            await erc20Token.mint(
              secondAccount.address,
              "1000000000000000000000000000000000000000000"
            );

            await expect(
              marketplace
                .connect(secondAccount)
                .fillOrder(
                  owner.address,
                  testERC1155.address,
                  tokenId,
                  Number(currentTime) - 10000,
                  Number(currentTime) + 3000,
                  price,
                  quantity,
                  blockNumber,
                  erc20Token.address,
                  signature
                )
            ).to.revertedWith(
              "Exchange is not approved to handle a sufficient amount of the ERC20."
            );
          });
        });
        it("should transfer the specified token from the buyer's address to the seller's address upon successful order fulfillment", async () => {
          const [owner, secondAccount] = await ethers.getSigners();

          const [currentTime, blockNumber, { chainId }] = await Promise.all([
            getCurrentTime(),
            ethers.provider.getBlockNumber(),
            ethers.provider.getNetwork(),
            paymentERC20Registry.addApprovedERC20(erc20Token.address),
          ]);

          const signature = await generateSignature({
            chainId,
            verifyingContract: marketplace.address,
            seller: owner.address,
            contractAddress: testERC1155.address,
            tokenId,
            startTime: Number(currentTime) - 10000,
            expiration: Number(currentTime) + 3000,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: erc20Token.address,
            signer: owner,
          });

          await testERC1155.setApprovalForAll(marketplace.address, true);

          await erc20Token
            .connect(secondAccount)
            .approve(marketplace.address, "10000000000000000000000000000000");
          await erc20Token.mint(
            secondAccount.address,
            "1000000000000000000000000000000000000000000"
          );

          const [balanceOfBuyerWallet, balanceOfSellerAccount] =
            await Promise.all([
              erc20Token.balanceOf(secondAccount.address),
              erc20Token.balanceOf(owner.address),
            ]);

          await expect(
            marketplace
              .connect(secondAccount)
              .fillOrder(
                owner.address,
                testERC1155.address,
                tokenId,
                Number(currentTime) - 10000,
                Number(currentTime) + 3000,
                price,
                quantity,
                blockNumber,
                erc20Token.address,
                signature
              )
          )
            .to.emit(marketplace, "BuyOrderFilled")
            .withArgs(
              owner.address,
              secondAccount.address,
              testERC1155.address,
              1,
              price,
              blockNumber,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000
            );
          const [
            balanceAfterSaleOfBuyerWallet,
            balanceAfterSaleOfSellerAccount,
          ] = await Promise.all([
            erc20Token.balanceOf(secondAccount.address),
            erc20Token.balanceOf(owner.address),
          ]);
          expect(balanceAfterSaleOfBuyerWallet).to.be.equal(
            balanceOfBuyerWallet.sub(price)
          );
          expect(balanceAfterSaleOfSellerAccount).to.be.equal(
            balanceOfSellerAccount.add(BigNumber.from(price))
          );
        });
        it("Should correctly transfer erc20 token from buyer address to seller address upon order fulfillment, while also transferring the correct amounts to the platform and maker wallets based on their set percentages", async () => {
          const [owner, secondAccount, makerWallet, platformWallet] =
            await ethers.getSigners();
          const [currentTime, blockNumber, { chainId }] = await Promise.all([
            getCurrentTime(),
            ethers.provider.getBlockNumber(),
            ethers.provider.getNetwork(),
            paymentERC20Registry.addApprovedERC20(erc20Token.address),
          ]);

          const signature = await generateSignature({
            chainId,
            verifyingContract: marketplace.address,
            seller: owner.address,
            contractAddress: testERC1155.address,
            tokenId,
            startTime: Number(currentTime) - 10000,
            expiration: Number(currentTime) + 3000,
            price,
            quantity,
            createdAtBlockNumber: blockNumber,
            paymentERC20: erc20Token.address,
            signer: owner,
          });

          await Promise.all([
            marketplace.setPlatFormPercentage(250),
            marketplace.setCreaterPercentage(350),
            marketplace.setMakerWallet(makerWallet.address),
            marketplace.setPlatFormWallet(platformWallet.address),
          ]);

          await testERC1155.setApprovalForAll(marketplace.address, true);
          // testNFT.mintToken();
          await erc20Token
            .connect(secondAccount)
            .approve(marketplace.address, "10000000000000000000000000000000");
          await erc20Token.mint(
            secondAccount.address,
            "1000000000000000000000000000000000000000000"
          );

          const [
            balanceOfBuyerWallet,
            balanceOfSellerAccount,
            balaceOfMakerWallet,
            balanceOfPlatformWallet,
          ] = await Promise.all([
            erc20Token.balanceOf(secondAccount.address),
            erc20Token.balanceOf(owner.address),
            erc20Token.balanceOf(makerWallet.address),
            erc20Token.balanceOf(platformWallet.address),
          ]);

          await expect(
            marketplace
              .connect(secondAccount)
              .fillOrder(
                owner.address,
                testERC1155.address,
                tokenId,
                Number(currentTime) - 10000,
                Number(currentTime) + 3000,
                price,
                quantity,
                blockNumber,
                erc20Token.address,
                signature
              )
          )
            .to.emit(marketplace, "BuyOrderFilled")
            .withArgs(
              owner.address,
              secondAccount.address,
              testERC1155.address,
              tokenId,
              price,
              blockNumber,
              Number(currentTime) - 10000,
              Number(currentTime) + 3000
            );
          const [
            balanceAfterSaleOfBuyerWallet,
            balanceAfterSaleOfSellerAccount,
            balanceAfterSaleOfMakerWallet,
            balanceAfterSaleOfPlatformWallet,
          ] = await Promise.all([
            erc20Token.balanceOf(secondAccount.address),
            erc20Token.balanceOf(owner.address),
            erc20Token.balanceOf(makerWallet.address),
            erc20Token.balanceOf(platformWallet.address),
          ]);

          const forPlatformWallet = BigNumber.from(price).mul(250).div(10000);
          const forMakerWallet = BigNumber.from(price).mul(350).div(10000);

          expect(balanceAfterSaleOfBuyerWallet).to.be.equal(
            balanceOfBuyerWallet.sub(price)
          );
          expect(balanceAfterSaleOfSellerAccount).to.be.equal(
            balanceOfSellerAccount.add(
              BigNumber.from(price).sub(forMakerWallet).sub(forPlatformWallet)
            )
          );
          expect(balanceAfterSaleOfMakerWallet).to.be.equal(
            balaceOfMakerWallet.add(forMakerWallet)
          );
          expect(balanceAfterSaleOfPlatformWallet).to.be.equal(
            balanceOfPlatformWallet.add(forPlatformWallet)
          );
        });
      });
    });
  });
});
