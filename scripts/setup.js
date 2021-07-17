/* eslint no-use-before-define: "warn" */
const fs = require("fs");
const chalk = require("chalk");
const { config, ethers, tenderly, run } = require("hardhat");
const R = require("ramda");
const distributionsJson = require("../artifacts/contracts/Distributions.sol/Distributions_v0.json");
const subscriptionsJson = require("../artifacts/contracts/Subscriptions.sol/Subscriptions_v0.json");
const pointsJson = require("../artifacts/contracts/SubRedditPoints.sol/SubredditPoints_v0.json");

const main = async () => {
    console.log("\n\n 📡 Setting up contracts...\n");

    let contractAddresses;
    try {
        contractAddresses = fs.readFileSync('contract_addresses.json', 'utf8')
        contractAddresses = JSON.parse(contractAddresses);
    } catch (e) {
        throw Error("Could  not read contract addresses", e)
    }

    const deployerWallet = ethers.provider.getSigner();
    const deployerWalletAddress = await deployerWallet.getAddress();
    console.log("deployer wallet address", deployerWalletAddress);

    const points = new ethers.Contract(contractAddresses.pointsAddress, pointsJson['abi'], deployerWallet);
    const dist = new ethers.Contract(contractAddresses.distributionAddress, distributionsJson['abi'], deployerWallet);
    const subs = new ethers.Contract(contractAddresses.subscriptionsAddress, subscriptionsJson['abi'], deployerWallet);

    await points.functions['initialize(address,address,address,string,string,string,address[])'](deployerWalletAddress, deployerWalletAddress, deployerWalletAddress, "Reddit", "CommunityPoints", "CP",[]);
    await dist.functions['initialize(address,address,address,address,uint256,uint256,uint256,uint256,uint256,address[],uint256[])'](deployerWalletAddress, points.address, deployerWalletAddress, deployerWalletAddress, '2000000', '1000000', '2000000', '1000', '5', [], []);
    await points.updateDistributionContract(dist.address);
    await subs.functions['initialize(address,address,address,uint256,uint256,uint256)'](deployerWalletAddress,deployerWalletAddress,points.address,"1", "60","6");
    await points.authorizeOperator(subs.address);
    const symbol = await points.symbol()

    console.info('*** SubredditPoints_v0 symbol: ***', symbol);
    console.info('Contracts setup successfully!');
};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
