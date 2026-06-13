const { PublicKey } = require('@solana/web3.js');
const axios = require('axios');

const config = {
  external: {
    dexscreenerUrl: 'https://api.dexscreener.com/latest/dex'
  }
};

async function fetchTokenMeta(mintAddress) {
  try {
    let lookupAddress = mintAddress;
    let isEvm = false;
    try {
      const pubkey = new PublicKey(mintAddress);
      const buffer = pubkey.toBuffer();
      let evmCheck = true;
      for (let i = 20; i < 32; i++) {
        if (buffer[i] !== 0) {
          evmCheck = false;
          break;
        }
      }
      if (evmCheck) {
        lookupAddress = '0x' + buffer.slice(0, 20).toString('hex');
        isEvm = true;
      }
    } catch (e) {
      console.log("Not a Solana key, checking if EVM string:", e.message);
      if (mintAddress.startsWith('0x')) {
        isEvm = true;
      }
    }

    console.log("isEvm:", isEvm);
    console.log("lookupAddress:", lookupAddress);

    const url = `${config.external.dexscreenerUrl}/tokens/${lookupAddress}`;
    console.log("URL:", url);
    const { data } = await axios.get(url, { timeout: 5000 });
    const pairs = data?.pairs ?? [];
    console.log("Pairs count:", pairs.length);
    if (!pairs.length) return {};
    const best = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0))[0];
    const meta = {
      name: best.baseToken?.name,
      symbol: best.baseToken?.symbol,
      imageUrl: best.info?.imageUrl ?? undefined,
      chainId: best.chainId ?? (isEvm ? 'monad' : 'solana'),
      originalAddress: lookupAddress,
      pairAddress: best.pairAddress,
    };
    return meta;
  } catch (err) {
    console.error("Error in fetchTokenMeta:", err);
    return {};
  }
}

async function main() {
  const mintAddress = '9HjnCvPRqou82V4gpMnMUjcKR1xTGHpVNqtN2jSwhMgT';
  const meta = await fetchTokenMeta(mintAddress);
  console.log("Result:", meta);
}
main();
