window.loadTheaterScript = async function () {
  if (!Array.isArray(window.THEATER_DATA_CHUNKS) || window.THEATER_DATA_CHUNKS.length !== 9) {
    throw new Error(`Unvollständige Textdaten: ${window.THEATER_DATA_CHUNKS?.length || 0} von 9 Paketen geladen.`);
  }

  const base64 = window.THEATER_DATA_CHUNKS.join('');
  const binary = atob(base64);
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));

  let text;
  if (window.pako?.ungzip) {
    text = window.pako.ungzip(bytes, { to: 'string' });
  } else if (typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(stream).text();
  } else {
    throw new Error('Dieser Browser kann die Textdaten nicht entpacken.');
  }

  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.paragraphs) || parsed.paragraphs.length < 1000) {
    throw new Error('Die entpackten Theaterdaten sind unvollständig.');
  }
  return parsed;
};