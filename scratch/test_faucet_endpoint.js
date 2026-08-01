async function testEndpoint() {
  console.log("Calling local /api/faucet endpoint...");
  const res = await fetch('http://localhost:3000/api/faucet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      address: '0xc0218f5894591b7b08ea186da3ad2a5e69e40b67',
      amount: 1000,
      fundGas: true
    })
  });
  const data = await res.json();
  console.log("Response status:", res.status);
  console.log("Response data:", data);
}

testEndpoint();
