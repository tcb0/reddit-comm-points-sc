const ethers = require("ethers");
const inboxAbi = require('../abis/Inbox.json')

require("dotenv").config();

const arbProvider = new ethers.providers.JsonRpcProvider(process.env.ARB_PROVIDER_URL);
const l1Provider = new ethers.providers.JsonRpcProvider(
    process.env.ETH_PROVIDER_URL
);


const globalInbox = (async () => {

    let l1wallet = ethers.Wallet.fromMnemonic(process.env.MNEMONIC);
    l1wallet = l1wallet.connect(l1Provider)

    let inbox = new ethers.Contract(process.env.ROLLUP_ADDRESS, inboxAbi, l1wallet)
    return inbox;
})()


module.exports = {
    arbProvider,
    l1Provider,
    globalInbox
}