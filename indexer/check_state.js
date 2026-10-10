
async function run() {
  const res = await fetch('http://localhost:8080/v1/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: '{ Commitment { id } }' })
  });
  console.log(await res.text());
}
run();
