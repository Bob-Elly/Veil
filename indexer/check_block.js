const fetch = require('node-fetch');
async function run() {
  try {
    const res = await fetch('https://testnet-rpc.monad.xyz/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'eth_blockNumber', params: [], id: 1 })
    });
    const json = await res.json();
    console.log('Current block:', parseInt(json.result, 16));
  } catch(e) {
    console.error(e.message);
  }
}
run();
