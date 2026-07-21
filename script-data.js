window.loadTheaterScript = async function () {
  const binary = atob(window.THEATER_DATA_CHUNKS.join(''));
  const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const text = await new Response(stream).text();
  return JSON.parse(text);
};
