/* eslint no-use-before-define: "warn" */
const yargs = require('yargs');
const fs = require("fs");
const {  ethers } = require("hardhat");
const pointsJson = require("../artifacts/contracts/SubRedditPoints.sol/SubredditPoints_v0.json");

const checkAddrBalance = async (address, pointsContract) => {
    const balance = await pointsContract.balanceOf(address);
    console.log(`Address stats: address: ${address}, balance: ${balance}`)
}

const checkIdBalance = async (id, pointsContract) => {

    let address = await pointsContract._registeredAccounts(id);

    const balance = await pointsContract.balanceOf(address);
    console.log(`Address stats: id: ${id}, address: ${address}, balance: ${balance}`)
}


const main = async (argv) => {
    let addrOrId = argv.addrOrId;
    let action = argv.action;

    let contractAddresses = fs.readFileSync('contract_addresses.json', 'utf8')
    contractAddresses = JSON.parse(contractAddresses);

    const deployerWallet = ethers.provider.getSigner();
    const pointsContract = new ethers.Contract(contractAddresses.pointsAddress, pointsJson['abi'], deployerWallet);

    if(action === 'addrBalance') {
        await checkAddrBalance(addrOrId, pointsContract);
    } else {
        await checkIdBalance(addrOrId, pointsContract);
    }

};

const argv = yargs
    .option('addrOrId', {
        alias: 'addrOrId',
        description: 'the address to check state for',
        type: 'string',
        default: ''
    })
    .option('action', {
        alias: 'action',
        description: 'the state check action',
        type: 'string',
        default: 'addrBalance'
    })
    .help()
    .alias('help', 'h')
    .argv;

main(argv)
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
