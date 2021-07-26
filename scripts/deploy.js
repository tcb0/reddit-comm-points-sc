/* eslint no-use-before-define: "warn" */
const fs = require("fs");
const chalk = require("chalk");
const { config, ethers, tenderly, run } = require("hardhat");
const { utils } = require("ethers");
const R = require("ramda");

const main = async () => {

  console.log("\n\n 📡 Deploying...\n");
  const deployerWallet = ethers.provider.getSigner();
  const deployerWalletAddress = await deployerWallet.getAddress();

  const points = await deploy("SubredditPoints_v0", [deployerWalletAddress, "Reddit", "CommunityPoints", "CP",[]])

  const dist = await deploy("Distributions_v0", [points.address, deployerWalletAddress, '2000000', '1000000', '2000000', '1000', '5'])
  await points.updateDistributionContract(dist.address);

  const subs = await deploy("Subscriptions_v0", [points.address,"1", "60","6"])
  await points.authorizeOperator(subs.address);
  const symbol = await points.symbol()


  fs.writeFileSync('contract_addresses.json',JSON.stringify({
    distributionAddress: dist.address,
    subscriptionsAddress: subs.address,
    pointsAddress: points.address
  }), 'utf-8');

  console.info('*** SubredditPoints_v0 symbol: ***', symbol);
  console.info('Contracts setup successfully!');
};

const deploy = async (contractName, _args = [], overrides = {}, libraries = {}) => {
  console.log(` 🛰  Deploying: ${contractName}`);

  const contractArgs = _args || [];
  const contractArtifacts = await ethers.getContractFactory(contractName,{libraries: libraries});
  const deployed = await contractArtifacts.deploy(...contractArgs, overrides);
  const encoded = abiEncodeArgs(deployed, contractArgs);
  fs.writeFileSync(`artifacts/${contractName}.address`, deployed.address);

  let extraGasInfo = ""
  if(deployed&&deployed.deployTransaction){
    const gasUsed = deployed.deployTransaction.gasLimit.mul(deployed.deployTransaction.gasPrice)
    extraGasInfo = `${utils.formatEther(gasUsed)} ETH, tx hash ${deployed.deployTransaction.hash}`
  }

  console.log(
    " 📄",
    chalk.cyan(contractName),
    "deployed to:",
    chalk.magenta(deployed.address)
  );
  console.log(
    " ⛽",
    chalk.grey(extraGasInfo)
  );

  await tenderly.persistArtifacts({
    name: contractName,
    address: deployed.address
  });

  if (!encoded || encoded.length <= 2) return deployed;
  fs.writeFileSync(`artifacts/${contractName}.args`, encoded.slice(2));

  return deployed;
};


// ------ utils -------

// abi encodes contract arguments
// useful when you want to manually verify the contracts
// for example, on Etherscan
const abiEncodeArgs = (deployed, contractArgs) => {
  // not writing abi encoded args if this does not pass
  if (
    !contractArgs ||
    !deployed ||
    !R.hasPath(["interface", "deploy"], deployed)
  ) {
    return "";
  }
  const encoded = utils.defaultAbiCoder.encode(
    deployed.interface.deploy.inputs,
    contractArgs
  );
  return encoded;
};




main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
