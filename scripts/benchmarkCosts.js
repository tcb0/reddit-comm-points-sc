/* eslint no-use-before-define: "warn" */
const fs = require("fs");
const chalk = require("chalk");
const R = require("ramda");
const { printTotalGasUsed } = require('./benchmarkLib')

const main = async () => {
    console.log("\n\n Benchmarking costs...\n");

    let txHashes = fs.readFileSync('txHashes.json');
    txHashes = JSON.parse(txHashes);

    let receipts = await printTotalGasUsed(txHashes)
    fs.writeFileSync('receipts.json', JSON.stringify(receipts), 'utf-8');


    let successCount = 0
    let failCount = 0
    for (const receipt of receipts) {
        if (receipt.status == 1) {
            successCount++
        } else {
            failCount++
        }
    }

    console.info("Done batch minting:");
    if (successCount > 0) {
        console.info(chalk.green(`${successCount} successful mints`))
    }
    if (failCount > 0) {
        console.info(chalk.red(`${failCount} failures:`))
    }


};

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
