const fs = require("fs");
require('dotenv').config()

require("@nomiclabs/hardhat-waffle");
require("@tenderly/hardhat-tenderly")

require("@nomiclabs/hardhat-etherscan");


const defaultNetwork = process.env.DEFAULT_NETWORK;

function mnemonic() {
  try {
    return fs.readFileSync("./mnemonic.txt").toString().trim();
  } catch (e) {
    if (defaultNetwork !== "localhost") {
      console.log("☢️ WARNING: No mnemonic file created for a deploy account. Try `yarn run generate` and then `yarn run account`.")
    }
  }
  return "";
}

module.exports = {
  defaultNetwork,



  networks: {
    localhost: {
      url: process.env.HARDHAT_PROVIDER_URL,
      /*
        notice no mnemonic here? it will just use account 0 of the hardhat node to deploy
        (you can put in a mnemonic here to set the deployer locally)
      */
      blockGasLimit: 1245000000,
      allowUnlimitedContractSize: true
    },
    arbitrum: {
      url: process.env.ARB_PROVIDER_URL,
      gasPrice: 0,
      chainId: 153869338190755,
      accounts: {
        mnemonic: process.env.MNEMONIC,
      },
    },
  },
  solidity: {
    version: "0.8.0",
    settings: {
      metadata: {
        // Not including the metadata hash
        // https://github.com/paulrberg/solidity-template/issues/31
        bytecodeHash: "none",
      },
      // You should disable the optimizer when debugging
      // https://hardhat.org/hardhat-network/#solidity-optimizer-support
      optimizer: {
        enabled: true,
        runs: 800,
      },
    },
  }
};
