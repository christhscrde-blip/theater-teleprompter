window.loadTheaterScript = async function () {
  const binary = atob(window.THEATER_DATA_CHUNKS.join(''));
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  let decoded;

  if (typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    decoded = new Uint8Array(await new Response(stream).arrayBuffer());
  } else {
    const { gunzipSync } = await import('https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js');
    decoded = gunzipSync(bytes);
  }

  const text = new TextDecoder('utf-8').decode(decoded);
  return JSON.parse(text);
};
