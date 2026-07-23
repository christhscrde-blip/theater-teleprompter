export const ACT=/^(ERSTER|ZWEITER|DRITTER|VIERTER|FÜNFTER|SECHSTER|SIEBTER|ACHTER|NEUNTER|ZEHNTER)\s+AKT\b|^AKT\s+[IVXLC\d]+\b/i;
export const SCENE=/^(\d+\.|ERSTE|ZWEITE|DRITTE|VIERTE|FÜNFTE|SECHSTE|SIEBTE|ACHTE|NEUNTE|ZEHNTE)\s+SZENE\b|^SZENE\s+[IVXLC\d]+\b/i;
const PAGE_HEADER=/^DIE\s+RÄUBER\s*[·•-]\s*BÜHNENMANUSKRIPT$/i;
const PAGE_NUMBER=/^Seite\s+(\d+)$/i;
const STANDALONE_LINE_NUMBER=/^(?:Zeile\s*)?(\d{1,4})\.?$/i;
const SPEAKER_STYLE=/(sprecher|figur|rolle|character|personenname|dramatis)/i;
const NON_NAME_PREFIXES=new Set(['ach','also','aber','das','der','die','du','ein','er','es','fort','gut','halt','ich','ihr','ja','nein','nun','sie','so','still','und','was','weg','wie','wir']);
const NAME_PARTICLES=new Set(['a','d','der','die','ein','eine','von','vom','zu','zur']);

export const clean=value=>String(value||'').replace(/\u00ad/g,'').replace(/[ \t]+/g,' ').replace(/\s+([,.;!?])/g,'$1').trim();

export function isLineNumber(text){
  const match=clean(text).match(STANDALONE_LINE_NUMBER);
  if(!match)return false;
  const number=Number(match[1]);
  return number>0&&number%5===0;
}

export function withoutPdfLineNumber(text){
  const match=clean(text).match(/^(?:Zeile\s*)?(\d{1,4})\.?\s+(.+)$/i);
  return match&&isLineNumber(match[1])?match[2]:text;
}

function usable(text){return text&&!PAGE_HEADER.test(text)&&!PAGE_NUMBER.test(text)&&!isLineNumber(text)}
function normalizedLine(raw){const line=typeof raw==='string'?{text:raw}:{...raw};line.text=clean(line.text);return line}
function speakerKey(text){
  return clean(text)
    .replace(/\s*\([^)]*\)\s*[.:–—-]*\s*$/u,'')
    .replace(/\s*[.:–—-]+\s*$/u,'')
    .replace(/\s+/g,' ')
    .toLocaleLowerCase('de-DE');
}
export function speakerLabel(text){
  return clean(text)
    .replace(/\s*\([^)]*\)\s*[.:–—-]*\s*$/u,'')
    .replace(/\s*[.:–—-]+\s*$/u,'');
}
function labelShape(text){
  const base=clean(text).replace(/\s*\([^)]*\)\s*[.:–—-]*\s*$/u,'').replace(/\s*[.:–—-]+\s*$/u,'');
  if(!base||base.length>55||/[!?;,„“"]/u.test(base))return false;
  const words=base.split(/\s+/);
  if(words.length>6)return false;
  return words.every(word=>/^(?:[A-ZÄÖÜ][\p{L}'’\-]*|[A-ZÄÖÜ]\.|[a-zäöü]\.)$/u.test(word)||NAME_PARTICLES.has(word.toLocaleLowerCase('de-DE').replace(/\.$/,'')));
}
function repeatedSpeakerLabels(lines){
  const counts=new Map();
  for(const line of lines){
    if(!labelShape(line.text))continue;
    const key=speakerKey(line.text);
    counts.set(key,(counts.get(key)||0)+1);
  }
  const inlineCounts=new Map();
  for(const line of lines){
    const match=line.text.match(/^([\p{L}][\p{L}'’\-]*(?:\s+[\p{L}][\p{L}'’\-]*){0,3})(?=\s*(?:\(|[.:]))/u);
    if(!match)continue;
    const key=clean(match[1]).toLocaleLowerCase('de-DE');
    if(NON_NAME_PREFIXES.has(key))continue;
    const remainder=line.text.slice(match[0].length);
    if(!/[.:)]\s*\S/u.test(remainder))continue;
    inlineCounts.set(key,(inlineCounts.get(key)||0)+1);
  }
  const knownFinalWords=new Set([...counts].filter(([,count])=>count>=2).map(([key])=>key.split(/\s+/).at(-1)?.replace(/[^\p{L}]/gu,'')));
  for(const [key,count] of inlineCounts){
    const finalWord=key.split(/\s+/).at(-1)?.replace(/[^\p{L}]/gu,'');
    const combined=counts.has(key)?counts.get(key)+count:count;
    if((counts.has(key)&&combined>=2)||count>=3||knownFinalWords.has(finalWord))counts.set(key,Math.max(combined,2));
  }
  return counts;
}
function inlineSpeaker(text,counts){
  const lower=text.toLocaleLowerCase('de-DE');
  const names=[...counts].filter(([,count])=>count>=2).map(([name])=>name).sort((a,b)=>b.length-a.length);
  for(const name of names){
    if(!lower.startsWith(name))continue;
    let cursor=name.length;
    if(/[\p{L}\d]/u.test(text[cursor]||''))continue;
    while(/\s/.test(text[cursor]||''))cursor++;
    let stage='';
    if(text[cursor]==='('){
      const end=text.indexOf(')',cursor+1);
      if(end<0)continue;
      stage=text.slice(cursor+1,end).trim();
      cursor=end+1;
      while(/\s/.test(text[cursor]||''))cursor++;
    }
    if(!/[.:]/.test(text[cursor]||''))continue;
    cursor++;
    const dialogueText=clean(text.slice(cursor));
    if(!dialogueText)continue;
    return{speakerPrefix:text.slice(0,name.length),speakerStage:stage,dialogueText};
  }
  return null;
}
function isKnownSpeaker(line,counts){
  const text=line.text;
  const key=speakerKey(text);
  if(ACT.test(text)||SCENE.test(text)||key.length>55)return false;
  const styleSignal=SPEAKER_STYLE.test(line.styleName||'');
  const formatSignal=Boolean(line.bold)&&!line.italic;
  const colonSignal=/:\s*$/.test(text);
  const repeated=(counts.get(key)||0)>=2;
  const finalWord=key.split(/\s+/).at(-1)?.replace(/[^\p{L}]/gu,'');
  const aliasShape=key.length<=55&&key.split(/\s+/).length<=6&&!/[!?;,„“"]/u.test(key);
  const aliasSignal=aliasShape&&finalWord?.length>=4&&[...counts].some(([candidate,count])=>count>=2&&candidate!==key&&candidate.split(/\s+/).at(-1)?.replace(/[^\p{L}]/gu,'')===finalWord);
  if(!labelShape(text)&&!aliasSignal&&!styleSignal&&!formatSignal)return false;
  return styleSignal||formatSignal||colonSignal||repeated||aliasSignal;
}
function isSpeaker(line,next,counts){
  if(!isKnownSpeaker(line,counts))return false;
  const hasFollowingText=Boolean(next?.text)&&!ACT.test(next.text)&&!SCENE.test(next.text);
  const strongSignal=SPEAKER_STYLE.test(line.styleName||'')||(Boolean(line.bold)&&!line.italic)||/:\s*$/.test(line.text)||/\([^)]*\)\.?\s*$/.test(line.text);
  return strongSignal||hasFollowingText;
}
function isDirection(text){
  return /^\(.+\)$/s.test(text)||/^(Auftritt|Abgang|Auftritte|Abgänge|Alle ab|Pause|Vorhang|Musik|Licht)\b/i.test(text);
}

function classify(line,previous,next,counts){
  const text=line.text;
  if(ACT.test(text))return'act';
  if(SCENE.test(text))return'scene';
  if(isSpeaker(line,next,counts))return'speaker';
  if(line.italic||isDirection(text))return'direction';
  if(previous&&['act','scene'].includes(previous.type))return'setting';
  if(previous?.type==='setting'&&next&&isKnownSpeaker(next,counts)&&text.length<100)return'setting';
  return'dialogue';
}

export function makeModel(rawPages,title,source){
  const prepared=rawPages.map(page=>page.map(normalizedLine).filter(line=>usable(line.text)));
  const allLines=prepared.flat();
  const counts=repeatedSpeakerLabels(allLines);
  const paragraphs=[],pages=[];
  let act=null,scene=null,currentSpeaker='',globalIndex=0;

  prepared.forEach((lines,pageIndex)=>{
    const firstIndex=paragraphs.length;
    for(let lineIndex=0;lineIndex<lines.length;lineIndex++){
      const line=lines[lineIndex];
      const previous=paragraphs.at(-1);
      const next=lines[lineIndex+1]||prepared[pageIndex+1]?.[0]||null;
      const inline=inlineSpeaker(line.text,counts);
      const type=inline?'speaker-dialogue':classify(line,previous,next,counts);
      if(type==='act'){act=line.text.toUpperCase();scene=null;currentSpeaker=''}
      if(type==='scene'){scene=line.text.toUpperCase();currentSpeaker=''}
      if(type==='speaker')currentSpeaker=speakerLabel(line.text);
      if(type==='speaker-dialogue')currentSpeaker=speakerLabel(inline.speakerPrefix);
      paragraphs.push({...line,...inline,type,speaker:currentSpeaker,page:pageIndex+1,act,scene,index:globalIndex++});
    }
    if(paragraphs.length>firstIndex)pages.push({page:pages.length+1,firstIndex,lastIndex:paragraphs.length-1});
  });

  const acts=paragraphs.filter(p=>p.type==='act').map(p=>({text:p.text,index:p.index,page:p.page}));
  const scenes=paragraphs.filter(p=>p.type==='scene').map(p=>({text:p.text,index:p.index,page:p.page,act:p.act}));
  return{title:title||'Theatertext',source,paragraphs,pages,acts,scenes,pageCount:pages.length};
}

export function logicalPages(lines,fileName,explicitPages){
  const isRauber=/räuber|raeuber/i.test(fileName)||lines.some(line=>/^DIE RÄUBER$/i.test(clean(typeof line==='string'?line:line.text)));
  if(explicitPages.length>=Math.max(3,Math.ceil(lines.length/80)))return explicitPages;
  const target=isRauber&&lines.length>1200?64:Math.max(1,Math.ceil(lines.length/24));
  const size=Math.ceil(lines.length/target),pages=[];
  for(let i=0;i<lines.length;i+=size)pages.push(lines.slice(i,i+size));
  return pages;
}
