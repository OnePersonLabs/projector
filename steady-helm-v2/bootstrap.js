const partUrls = ['./app.js.gz.b64.part.00', './app.js.gz.b64.part.01'];

async function loadRuntime() {
  const encoded = (await Promise.all(partUrls.map(async (url) => {
    const response = await fetch(url, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
    return response.text();
  }))).join('').replace(/\s+/g, '');

  const packed = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  if (!('DecompressionStream' in window)) {
    throw new Error('This browser does not support gzip DecompressionStream.');
  }
  const stream = new Blob([packed]).stream().pipeThrough(new DecompressionStream('gzip'));
  const source = await new Response(stream).text();
  const moduleUrl = URL.createObjectURL(new Blob([source], { type: 'text/javascript' }));
  try {
    await import(moduleUrl);
  } finally {
    setTimeout(() => URL.revokeObjectURL(moduleUrl), 1000);
  }
}

loadRuntime().catch((error) => {
  console.error(error);
  const card = document.querySelector('#loadingCard');
  if (card) {
    card.classList.remove('done');
    card.innerHTML = `<strong>Viewer failed to start</strong><span>${error.message}</span>`;
  }
});
