async function test() {
  try {
    const res = await fetch('http://localhost:3001/status');
    console.log(await res.text());
  } catch (e) {
    console.error(e.message);
  }
}
test();
