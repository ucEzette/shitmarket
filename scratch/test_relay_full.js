async function testRelayFull() {
  console.log("Fetching chains from https://api.relay.link/chains ...");
  const res = await fetch('https://api.relay.link/chains');
  const data = await res.json();
  const chains = data.chains || [];
  console.log(`Total chains available: ${chains.length}`);
  
  // Log top 15 chains with icons and token counts
  chains.slice(0, 15).forEach(c => {
    const tokenCount = (c.featuredTokens?.length || 0) + (c.erc20Currencies?.length || 0);
    console.log(`Chain ID: ${c.id} | Name: ${c.displayName || c.name} | VM: ${c.vmType} | Tokens: ${tokenCount}`);
  });

  // Test quote with requestId
  console.log("\nTesting quote POST with requestId...");
  const quoteRes = await fetch('https://api.relay.link/quote/v2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      user: '0x467681376bf937691DacF6014c3D2a0abeE556E0',
      originChainId: 8453,
      destinationChainId: 43114,
      originCurrency: '0x0000000000000000000000000000000000000000',
      destinationCurrency: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e',
      amount: '5000000000000000',
      tradeType: 'EXACT_INPUT',
      recipient: '0x467681376bf937691DacF6014c3D2a0abeE556E0'
    })
  });
  const quote = await quoteRes.json();
  console.log("Quote status:", quoteRes.status);
  if (quote.steps) {
    const stepItem = quote.steps[0].items[0];
    console.log("Deposit Address (to):", stepItem.data?.to);
    console.log("Value (wei):", stepItem.data?.value);
    console.log("Check Endpoint:", stepItem.check?.endpoint);
  }
}

testRelayFull();
