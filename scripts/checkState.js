/* eslint no-use-before-define: "warn" */
const fs = require("fs");
const chalk = require("chalk");
const { config, ethers, tenderly, run } = require("hardhat");
const pointsJson = require("../artifacts/contracts/SubRedditPoints.sol/SubredditPoints_v0.json");

const checkAddrBalance = async (addressData, pointsContract) => {
    const addresses = Object.keys(addressData);
    const address0 = addresses[0];
    const karma = addressData[address0];
    const balance = await pointsContract.balanceOf(address0);
    console.log(`Address stats: address: ${address0}, karma: ${karma}, balance: ${balance}`)
}

const checkRegisteredAccounts = async (pointsContract) => {

    const address0 = await pointsContract._registeredAccounts(0);
    console.log(`Registered account0: ${address0}`);

};

const main = async () => {
    let addrFile = fs.readFileSync('reddit-data-decoded/bricks/b1_round_1_finalized.json', 'utf8')
    addrFile = JSON.parse(addrFile);

    let contractAddresses = fs.readFileSync('contract_addresses.json', 'utf8')
    contractAddresses = JSON.parse(contractAddresses);

    const deployerWallet = ethers.provider.getSigner();

    const pointsContract = new ethers.Contract(contractAddresses.pointsAddress, pointsJson['abi'], deployerWallet);

    const addressData = addrFile.addresses;
    await checkAddrBalance(addressData, pointsContract);


    await checkRegisteredAccounts(pointsContract);


};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
