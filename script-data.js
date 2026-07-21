window.loadTheaterScript = async function () {
  if (window.THEATER_SCRIPT?.paragraphs?.length >= 1000) {
    return window.THEATER_SCRIPT;
  }

  const chunks = window.THEATER_DATA_CHUNKS;
  if (!Array.isArray(chunks) || chunks.length !== 9) {
    throw new Error(`Textpakete fehlen: ${chunks?.length || 0}/9`);
  }

  const joined = chunks.join('');
  const cleaned = joined.replace(/[^A-Za-z0-9+/=]/g, '');
  const withoutPadding = cleaned.replace(/=+$/g, '');
  const padded = withoutPadding + '='.repeat((4 - (withoutPadding.length % 4)) % 4);

  if (padded.length < 1000) {
    throw new Error(`Textdaten sind zu kurz: ${padded.length} Zeichen`);
  }

  let binary;
  try {
    binary = atob(padded);
  } catch (error) {
    throw new Error(`Base64-Daten ungültig: ${error.message}`);
  }

  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  let text;

  try {
    if (typeof DecompressionStream !== 'undefined') {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      text = await new Response(stream).text();
    } else if (window.pako?.ungzip) {
      text = window.pako.ungzip(bytes, { to: 'string' });
    } else {
      throw new Error('Keine GZip-Unterstützung verfügbar');
    }
  } catch (error) {
    throw new Error(`Textdaten konnten nicht entpackt werden: ${error.message}`);
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new Error(`Textdaten sind kein gültiges JSON: ${error.message}`);
  }

  if (parsed?.title !== 'Die Räuber') {
    throw new Error('Falsches Theaterstück in den Textdaten');
  }
  if (!Array.isArray(parsed.paragraphs) || parsed.paragraphs.length !== 1457) {
    throw new Error(`Theatertext unvollständig: ${parsed?.paragraphs?.length || 0}/1457 Absätze`);
  }
  if (parsed.pageCount !== 64) {
    throw new Error(`Seitenzahl unvollständig: ${parsed.pageCount || 0}/64`);
  }

  return parsed;
};