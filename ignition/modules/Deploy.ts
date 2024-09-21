// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const MultisigWalletModule = buildModule("MultisigWalletModule", (m) => {

  // Define the token addresses (these should be set according to your network)
  const usdcAddress = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC address on Ethereum
  const daiAddress = "0x6B175474E89094C44Da98b954EedeAC495271d0F";  // DAI address on Ethereum
  const uniAddress = "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";  // UNI address on Ethereum
  const linkAddress = "0x514910771AF9Ca656af840dff83E8264EcF986CA"; // LINK address on Ethereum
  
  // Supported tokens array (USDC, DAI, UNI, LINK)
  const supportedTokens = [usdcAddress, daiAddress, uniAddress, linkAddress];

  // Other constructor parameters
  const primaryToken = usdcAddress; // Assuming USDC is the primary token for savings
  const fixedMonthlyContribution = 100 * 10**6; // Example value (100 USDC in 6 decimal places)
  const investmentThreshold = 200 * 10**6; // Example value (200 USDC)
  const investmentPercentage = 50; // Example percentage (50%)
  const investmentReturnRate = 15; // Example return rate (1.5%)
  const uniswapRouter = "0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f"; // Example Uniswap V2 router address on Ethereum

  // Deploy the MultisigWallet contract with the specified constructor arguments
  const multisigWallet = m.contract("MultisigWallet", [
    primaryToken,
    supportedTokens,
    fixedMonthlyContribution,
    investmentThreshold,
    investmentPercentage,
    investmentReturnRate,
    uniswapRouter
  ]);

  return { multisigWallet };
});

export default MultisigWalletModule;
