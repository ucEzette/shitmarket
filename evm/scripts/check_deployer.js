const ethers = require('ethers');

async function main() {
    const pk = '0xc8fd10b0ee69676024fb28db95374116bdeab78dbfbf439667e679b7b335ae71';
    
    // Mainnet
    const providerMainnet = new ethers.JsonRpcProvider('https://api.avax.network/ext/bc/C/rpc');
    const walletMainnet = new ethers.Wallet(pk, providerMainnet);
    const nonceMainnet = await providerMainnet.getTransactionCount(walletMainnet.address);
    const balanceMainnet = await providerMainnet.getBalance(walletMainnet.address);
    console.log(`Mainnet - Address: ${walletMainnet.address}`);
    console.log(`Mainnet - Balance: ${ethers.formatEther(balanceMainnet)} AVAX`);
    console.log(`Mainnet - Nonce: ${nonceMainnet}`);

    // Fuji
    const providerFuji = new ethers.JsonRpcProvider('https://api.avax-test.network/ext/bc/C/rpc');
    const walletFuji = new ethers.Wallet(pk, providerFuji);
    const nonceFuji = await providerFuji.getTransactionCount(walletFuji.address);
    console.log(`Fuji - Nonce: ${nonceFuji}`);
}

main().catch(console.error);
