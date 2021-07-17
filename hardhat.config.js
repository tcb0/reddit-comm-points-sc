const fs = require("fs");

require("@nomiclabs/hardhat-waffle");
require("@tenderly/hardhat-tenderly")

require("@nomiclabs/hardhat-etherscan");

const defaultNetwork = "arbitrum";

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
      url: "http://localhost:8545",
      /*
        notice no mnemonic here? it will just use account 0 of the hardhat node to deploy
        (you can put in a mnemonic here to set the deployer locally)
      */
      blockGasLimit: 1245000000,
      allowUnlimitedContractSize: true
    },
    arbitrum: {
      url: "http://localhost:8547",
      gasPrice: 0,
      chainId: 153869338190755,
      accounts: {
        mnemonic: "surge ability together fruit retire harvest release turkey social coffee owner uphold panel group car",
      },
    },
  },
  solidity: {
    compilers: [
      {
        version: "0.5.17",
        evmVersion: "istanbul",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200
          }
        }
      }
    ],

  }
};
