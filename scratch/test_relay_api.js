async function testRelayApi() {
  try {
    console.log("Testing POST https://api.relay.link/quote/v2 (Base ETH -> Avalanche USDC)...");
    const quoteRes = await fetch('https://api.relay.link/quote/v2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user: '0x467681376bf937691DacF6014c3D2a0abeE556E0',
        originChainId: 8453, // Base
        destinationChainId: 43114, // Avalanche C-Chain
        originCurrency: '0x0000000000000000000000000000000000000000', // ETH on Base
        destinationCurrency: '0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e', // Native USDC on Avax
        amount: '5000000000000000', // 0.005 ETH (~$9.30)
        tradeType: 'EXACT_INPUT',
        recipient: '0x467681376bf937691DacF6014c3D2a0abeE556E0'
      })
    });
    const quoteData = await quoteRes.json();
    console.log("Quote v2 response status:", quoteRes.status);
    if (quoteRes.status === 200) {
      console.log("SUCCESS! Deposit quote returned:");
      console.log("Estimated Time:", quoteData.details?.timeEstimate, "seconds");
      console.log("Input:", quoteData.details?.currencyIn?.amountFormatted, quoteData.details?.currencyIn?.currency?.symbol);
      console.log("Output USDC:", quoteData.details?.currencyOut?.amountFormatted, quoteData.details?.currencyOut?.currency?.symbol);
      console.log("Execution Steps:", quoteData.steps?.length);
      console.log("Step 1 data:", JSON.stringify(quoteData.steps[0].items[0].data, null, 2));
    } else {
      console.log("Quote error:", quoteData);
    }
  } catch (err) {
    console.error("Relay API error:", err);
  }
}

testRelayApi();
