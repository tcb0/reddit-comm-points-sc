/* eslint no-use-before-define: "warn" */
const fs = require("fs");
const {BridgeHelper} = require('arb-ts')
const {arbProvider} = require('./contractsLib')

const main = async () => {
    let txData = fs.readFileSync('batch-minting/bricks/round_1_finalized/txData.json', 'utf-8')
    txData = JSON.parse(txData);

    let l2txHash = txData.l2Receipts[0].txHash;
    let l2txReceipt = await  BridgeHelper.getL2Transaction(l2txHash, arbProvider)

    console.log(l2txReceipt)




};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
