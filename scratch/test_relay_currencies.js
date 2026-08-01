async function testCurrencies() {
  const res = await fetch('https://api.relay.link/chains');
  const data = await res.json();
  const avax = data.chains.find(c => c.id === 43114);
  console.log("Avax Chain Data:", JSON.stringify(avax, null, 2));

  // Search tokens on Avax (43114) via Relay currency endpoint
  const tokRes = await fetch('https://api.relay.link/currencies/v1?chainId=43114');
  const tokData = await tokRes.json();
  console.log("Avax currencies status:", tokRes.status);
  console.log("Avax currencies count:", tokData.currencies?.length || tokData.length);
  if (tokData.currencies) {
    console.log("Sample tokens on Avax:", tokData.currencies.slice(0, 10).map(t => ({ symbol: t.symbol, address: t.address, name: t.name })));
  }
}

testCurrencies().catch(console.error);
