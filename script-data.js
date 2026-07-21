window.loadTheaterScript = async function () {
  const encoded = window.THEATER_DATA_CHUNKS.join('');
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  let text;
  if (typeof TextDecoder !== 'undefined') {
    text = new TextDecoder('utf-8').decode(bytes);
  } else {
    let escaped = '';
    for (let index = 0; index < bytes.length; index += 1) {
      escaped += `%${bytes[index].toString(16).padStart(2, '0')}`;
    }
    text = decodeURIComponent(escaped);
  }

  return JSON.parse(text);
};
