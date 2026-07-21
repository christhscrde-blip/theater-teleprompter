(() => {
  'use strict';

  const PAYLOAD_FILES = [
    './theater-payload-01.txt?v=9',
    './theater-payload-02.txt?v=9',
    './theater-payload-03.txt?v=9',
    './theater-payload-04.txt?v=9'
  ];

  let loadPromise = null;

  function cleanBase64(value) {
    return value.replace(/[^A-Za-z0-9+/=]/g, '');
  }

  function decodeBase64(base64) {
    const cleaned = cleanBase64(base64);
    const withoutPadding = cleaned.replace(/=+$/g, '');
    const padded = withoutPadding + '='.repeat((4 - (withoutPadding.length % 4)) % 4);
    const binary = atob(padded);
    return Uint8Array.from(binary, character => character.charCodeAt(0));
  }

  async function fetchPayload() {
    const responses = await Promise.all(PAYLOAD_FILES.map(file => fetch(file, { cache: 'no-store' })));
    responses.forEach((response, index) => {
      if (!response.ok) throw new Error(`Textpaket ${index + 1} fehlt (${response.status})`);
    });
    const raw = (await Promise.all(responses.map(response => response.text()))).join('');
    const cleaned = cleanBase64(raw);
    if (!cleaned.startsWith('H4sI')) {
      throw new Error('Die Textpakete enthalten keinen gültigen GZip-Datenstrom.');
    }
    return cleaned;
  }

  async function decompress(bytes) {
    if (typeof DecompressionStream === 'undefined') {
      throw new Error('Dieser Browser unterstützt die benötigte GZip-Entpackung nicht.');
    }
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return new Response(stream).text();
  }

  function validate(data) {
    if (!data || data.title !== 'Die Räuber') throw new Error('Die Textdaten gehören nicht zu „Die Räuber“.');
    if (!Array.isArray(data.paragraphs) || data.paragraphs.length !== 1457) {
      throw new Error(`Theatertext unvollständig: ${data?.paragraphs?.length || 0}/1457 Absätze`);
    }
    if (data.pageCount !== 63 || data.physicalPageCount !== 64) {
      throw new Error('Die Seitenstruktur des Theatertexts ist unvollständig.');
    }
    if (data.paragraphs[0]?.text !== 'FRIEDRICH SCHILLER' || data.paragraphs.at(-1)?.text !== 'ENDE') {
      throw new Error('Anfang oder Ende des Theatertexts fehlt.');
    }
    return data;
  }

  window.loadTheaterScript = function loadTheaterScript() {
    if (!loadPromise) {
      loadPromise = (async () => {
        const payload = await fetchPayload();
        let source;
        try {
          source = (await decompress(decodeBase64(payload))).trim();
        } catch (error) {
          throw new Error(`Textpakete konnten nicht entpackt werden: ${error?.message || error}`);
        }
        const prefix = 'window.THEATER_SCRIPT=';
        if (!source.startsWith(prefix) || !source.endsWith(';')) {
          throw new Error('Das eingebaute Theater-Datenformat ist ungültig.');
        }
        return validate(JSON.parse(source.slice(prefix.length, -1)));
      })();
    }
    return loadPromise;
  };
})();
