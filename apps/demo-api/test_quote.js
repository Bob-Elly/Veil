async function test() {
  const res = await fetch('http://localhost:3002/quote');
  console.log("Status:", res.status);
  console.log("PAYMENT-REQUIRED:", res.headers.get('PAYMENT-REQUIRED') ? Buffer.from(res.headers.get('PAYMENT-REQUIRED'), 'base64').toString('utf-8') : null);
}
test();
