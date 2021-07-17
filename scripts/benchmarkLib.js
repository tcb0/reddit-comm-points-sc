const {l1Provider, arbProvider, globalInbox} = require('./contractsLib')
const chalk = require("chalk");
const ethers = require('ethers')
const getReceipts = async (txHashData) => {
    try {
        let receipts = []
        for (let txHashKey of Object.keys(txHashData)) {
            let tx = await arbProvider.getTransaction(txHashData[txHashKey].txHash)
            let txReceipt = await tx.wait();
            receipts.push({
                txHash: tx.hash,
                data: tx.data,
                dataLength: tx.data.length,
                from: tx.from,
                to: tx.to,
                gasLimit: tx.gasLimit.toNumber(),
                gasPrice: tx.gasPrice.toNumber(),
                gasUsed: txReceipt.gasUsed.toNumber(),
                blockNumber: txReceipt.blockNumber
            })
        }
        return receipts
    } catch(err) {
        console.warn(chalk.red("error getting txn responses", err));
        return []
    }
};


const getTxData = async (txHashData) => {
    try {
        let receipts = await getReceipts(txHashData)
        const startBlock  = receipts.reduce((acc, curr)=> Math.min(acc,curr.blockNumber),Infinity)
        const endBlock  = receipts.reduce((acc, curr)=> Math.max(acc,curr.blockNumber),0)
        const totalGasUsed = receipts.reduce(
            (acc, current) => acc + current.gasUsed, 0
        );
        console.log(chalk.green(`Used ${totalGasUsed} ArbGas`));

        let l1Stats = await getL1gasStats(startBlock, endBlock, txHashData);
        return {
            l2Receipts: receipts,
            l1Stats: l1Stats
        }
    } catch(err) {
        console.warn(chalk.red("error getting txn responses", err));
        throw err
    }

}

const getL1gasStats = async (startBlockHeight, endBlockHeight, txHashData) => {
    const inbox = await globalInbox;
    const inboxMessageDeliveredFromOriginFragment = inbox.interface.events['InboxMessageDeliveredFromOrigin(uint256)']
    const deliveredFromOriginTopic = inbox.interface.getEventTopic(inboxMessageDeliveredFromOriginFragment)
    let logs = await l1Provider.getLogs({
        topics: [deliveredFromOriginTopic],
        fromBlock: 0,
        toBlock: 'latest',
    });

    logs = logs.slice(logs.length - Object.keys(txHashData).length)


    let totalGasUsed = ethers.BigNumber.from(0);
    let l1TxsData = [];
    for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        const tx = await l1Provider.getTransaction(log.transactionHash);
        const txnReceipt = await tx.wait();
        console.info(chalk.green(`Make L1 aggregator tx ${log.transactionHash}, gasUsed: ${txnReceipt.gasUsed}`))
        totalGasUsed = totalGasUsed.add(txnReceipt.gasUsed);
        let gasUsed = txnReceipt.gasUsed.toNumber();
        l1TxsData.push({
           txHash: log.transactionHash,
           from: tx.from,
           to: tx.to,
           gasUsed: gasUsed,
           gasPrice: tx.gasPrice.toNumber(),
           gasLimit: tx.gasLimit.toNumber(),
           data: tx.data,
           dataLength: tx.data.length,
           fileName: txHashData[i].fileName,
           l2TxHash: txHashData[i].txHash,
           l2TxBytes: txHashData[i].bytes
        });
    }
    console.info(
        chalk.green(
            `Used ${totalGasUsed} L1 gas over ${logs.length} ${
                logs.length === 1 ? "batch" : "batches"
            }`
        )
    );
    return {
        txData: l1TxsData,
        totalGasUsed: totalGasUsed.toNumber()
    }
}

module.exports = {
    getTxData,
    getReceipts
}