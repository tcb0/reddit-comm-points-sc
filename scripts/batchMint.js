/* eslint no-use-before-define: "warn" */
const yargs = require('yargs');
const fs = require("fs");
const chalk = require("chalk");
const { config, ethers, tenderly, run , hre } = require("hardhat");
const R = require("ramda");
const { getTxData } = require('./benchmarkLib')
const distributions = require("../artifacts/contracts/Distributions.sol/Distributions_v0.json");
const {getFileNames} = require('./utils')


const batchMint = async (readDirPath, writeDirPath) => {

    console.log("\n\n 📡 Batch minting reddit points...\n");
    const deployerWallet = ethers.provider.getSigner();
    const deployerWalletAddress = await deployerWallet.getAddress();
    console.log("Deployer address", deployerWalletAddress);

    let contractAddresses;
    try {
        contractAddresses = fs.readFileSync('contract_addresses.json', 'utf8')
        contractAddresses = JSON.parse(contractAddresses);
    } catch (e) {
        throw Error("Could  not read contract addresses", e)
    }

    let txHashData = {}
    let nonce = await deployerWallet.getTransactionCount();

    const dist = new ethers.Contract(contractAddresses.distributionAddress, distributions['abi'], deployerWallet);

    let compressedData = {

    };

    let index = 0;

    const files = getFileNames(`${readDirPath}`);

    for (let file of files) {

        let binaryData = fs.readFileSync(`${readDirPath}/${file}`);
        const bytes = Buffer.byteLength(binaryData);
        console.info(chalk.blueBright(`minting ${file}, bytes: ${bytes}`));

        let binDataHex = "0x" + binaryData.toString("hex");
        const mintingTxHash = (await dist.batchMint(
            binDataHex,
            {
                // gasLimit: ethers.BigNumber.from(10000000000000),
                nonce,
                gasPrice: 0
            }
        )).hash;
        txHashData[index] = {
            txHash: mintingTxHash,
            fileName: file,
            bytes: bytes
        }
        compressedData[file] = {
            bytes: bytes,
            txHash: mintingTxHash
        }
        console.log("tx minted", mintingTxHash);
        nonce += 1
        index += 1;
    }

    if(!fs.existsSync(`${writeDirPath}`)) {
        fs.mkdirSync(`${writeDirPath}`, {recursive:true})
    }

    fs.writeFileSync(`${writeDirPath}/compressedDataMonths.json`, JSON.stringify(compressedData), 'utf-8');

    fs.writeFileSync(`${writeDirPath}/txHashData.json`, JSON.stringify(txHashData), 'utf-8');

    let txData = await getTxData(txHashData);
    fs.writeFileSync(`${writeDirPath}/txData.json`, JSON.stringify(txData), 'utf-8');
    console.info("Done batch minting.");

};



const main = async (argv) => {

    console.log("ARGV", argv);

    const dataset = argv.dataset;
    const encType = argv.encType;
    const round = argv.round;
    const test = argv.test;


    let readDir;
    let writeDir;

    if(test) {
        console.log("Batch minting test data...")
        readDir = `data/encodedChunked/test/${encType}/${dataset}/${round}`
        writeDir = `data/batch-minting-test/${encType}/${dataset}/${round}`
    } else {
        console.log("Batch minting data...")
        readDir = `data/encodedChunked/${encType}/${dataset}/${round}`
        writeDir = `data/batch-minting/${encType}/${dataset}/${round}`
    }

    if(!fs.existsSync(writeDir)) {
        fs.mkdirSync(writeDir, {recursive: true})
    }

    await batchMint(readDir, writeDir)


};


const argv = yargs
    .option('encType', {
        alias: 'encType',
        description: 'the encoding type',
        type: 'string',
        choices: ['rlp', 'native', 'bitmap'],
        default: 'rlp'
    })
    .option('dataset', {
        alias: 'd',
        description: 'the dataset to operate on',
        type: 'string',
        choices: ['bricks', 'moons'],
        default: 'bricks'
    })
    .option('round', {
        alias: 'r',
        description: 'the distribution round',
        type: 'string',
        default: 'round_1_finalized'
    }).
    option('test', {
        alias: 'test',
        description: 'generate test chunks',
        type: 'boolean',
        default: false
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
