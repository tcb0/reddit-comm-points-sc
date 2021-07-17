/* eslint no-use-before-define: "warn" */
const fs = require("fs");
const chalk = require("chalk");
const { config, ethers, tenderly, run } = require("hardhat");
const { utils } = require("ethers");
const inboxAbi = require('../abis/Inbox.json')
const R = require("ramda");
const {L1Bridge} = require('arb-ts')
require("dotenv").config();

const main = async () => {
    console.log("\n\n 📡 Setting up contracts...\n");



    const l1Provider = new ethers.providers.JsonRpcProvider(
        process.env.ETH_PROVIDER_URL
    );

    let l1wallet = ethers.Wallet.fromMnemonic(process.env.MNEMONIC);
    l1wallet = l1wallet.connect(l1Provider)

    let inbox = new ethers.Contract(process.env.ROLLUP_ADDRESS, inboxAbi, l1wallet)
    console.log("INBOX", inbox);

    const bridge = await inbox.bridge()

    console.log(bridge)



    // const globalInboxAddress = await arbRollup.globalInbox({gasLimit: ethers.BigNumber.from(100000000000000)})

    // const globalIndex = new ethers.Contract(globalInboxAddress, globalInboxFactoryAbi, l1Wallet);

    // console.log("globalIndex", globalIndex)
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
