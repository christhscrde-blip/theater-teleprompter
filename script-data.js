window.loadTheaterScript = async function () {
  if (window.THEATER_SCRIPT?.paragraphs?.length >= 1000) {
    return window.THEATER_SCRIPT;
  }

  if (!Array.isArray(window.THEATER_DATA_CHUNKS) || window.THEATER_DATA_CHUNKS.length !== 9) {
    throw new Error(`Textpakete fehlen: ${window.THEATER_DATA_CHUNKS?.length || 0}/9`);
  }

  const binary = atob(window.THEATER_DATA_CHUNKS.join(''));
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  let text;

  if (typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(stream).text();
  } else if (window.pako?.ungzip) {
    text = window.pako.ungzip(bytes, { to: 'string' });
  } else {
    throw new Error('Keine GZip-Unterstützung verfügbar');
  }

  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed?.paragraphs) || parsed.paragraphs.length < 1000) {
    throw new Error(`Theatertext unvollständig: ${parsed?.paragraphs?.length || 0} Absätze`);
  }
  return parsed;
};
