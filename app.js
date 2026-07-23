import{clean,isLineNumber,withoutPdfLineNumber,makeModel,logicalPages}from'./classification.js';

const PDFJS_VERSION='4.10.38';
const pdfjsLib=await import(`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`);
pdfjsLib.GlobalWorkerOptions.workerSrc=`https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`;

const $=s=>document.querySelector(s);
const els={fileInput:$('#fileInput'),importStatus:$('#importStatus'),workspace:$('#workspace'),documentTitle:$('#documentTitle'),navigationList:$('#navigationList'),tabs:[...document.querySelectorAll('.tab')],stage:$('#stage'),scriptDisplay:$('#scriptDisplay'),locationText:$('#locationText'),pageText:$('#pageText'),progressText:$('#progressText'),previousButton:$('#previousButton'),nextButton:$('#nextButton'),rewindButton:$('#rewindButton'),forwardButton:$('#forwardButton'),playButton:$('#playButton'),speedInput:$('#speedInput'),speedValue:$('#speedValue'),fontInput:$('#fontInput'),fontValue:$('#fontValue'),lineHeightInput:$('#lineHeightInput'),lineHeightValue:$('#lineHeightValue'),themeButton:$('#themeButton'),fullscreenButton:$('#fullscreenButton'),exitPresentationButton:$('#exitPresentationButton')};
let model=null,playing=false,animation=0,lastTime=0,scrollPosition=0,navMode='acts',currentPage=1,nativeFullscreenObserved=false,lineOffsets=[],positionFrame=0,layoutFrame=0;

const wordValue=(node,ns)=>node?.getAttributeNS(ns,'val')??node?.getAttribute('w:val')??node?.getAttribute('val');
function wordFlag(container,tag,ns){const node=container?.getElementsByTagNameNS(ns,tag)[0];if(!node)return undefined;return !/^(0|false|off)$/i.test(wordValue(node,ns)||'true')}
function directProperties(container,ns){return{italic:wordFlag(container,'i',ns)??wordFlag(container,'iCs',ns),bold:wordFlag(container,'b',ns)??wordFlag(container,'bCs',ns)}}
function docxStyleMap(xml,ns){
  if(!xml)return new Map();
  const doc=new DOMParser().parseFromString(xml,'application/xml'),raw=new Map(),resolved=new Map();
  for(const style of doc.getElementsByTagNameNS(ns,'style')){
    const id=style.getAttributeNS(ns,'styleId')||style.getAttribute('w:styleId');
    if(!id)continue;
    raw.set(id,{id,name:wordValue(style.getElementsByTagNameNS(ns,'name')[0],ns)||id,basedOn:wordValue(style.getElementsByTagNameNS(ns,'basedOn')[0],ns),...directProperties(style.getElementsByTagNameNS(ns,'rPr')[0],ns)});
  }
  const resolve=(id,seen=new Set())=>{
    if(!id||seen.has(id))return{};
    if(resolved.has(id))return resolved.get(id);
    seen.add(id);
    const own=raw.get(id)||{},base=resolve(own.basedOn,seen);
    const value={name:own.name||base.name||id,italic:own.italic??base.italic??false,bold:own.bold??base.bold??false};
    resolved.set(id,value);
    return value;
  };
  for(const id of raw.keys())resolve(id);
  return resolved;
}
function docxParagraph(p,styles,ns){
  const pPr=p.getElementsByTagNameNS(ns,'pPr')[0],styleId=wordValue(pPr?.getElementsByTagNameNS(ns,'pStyle')[0],ns),style=styles.get(styleId)||{};
  const paragraphDirect=directProperties(pPr?.getElementsByTagNameNS(ns,'rPr')[0],ns);
  let italicChars=0,boldChars=0,totalChars=0;
  const text=[...p.getElementsByTagNameNS(ns,'r')].map(run=>{
    const value=[...run.getElementsByTagNameNS(ns,'t')].map(node=>node.textContent).join('');
    const length=value.replace(/\s/g,'').length;
    const rPr=run.getElementsByTagNameNS(ns,'rPr')[0],runStyleId=wordValue(rPr?.getElementsByTagNameNS(ns,'rStyle')[0],ns),runStyle=styles.get(runStyleId)||{};
    const direct=directProperties(rPr,ns);
    const italic=direct.italic??runStyle.italic??paragraphDirect.italic??style.italic??false;
    const bold=direct.bold??runStyle.bold??paragraphDirect.bold??style.bold??false;
    totalChars+=length;
    if(italic)italicChars+=length;
    if(bold)boldChars+=length;
    return value;
  }).join('');
  return{text:clean(text),italic:totalChars>0&&italicChars/totalChars>=.55,bold:totalChars>0&&boldChars/totalChars>=.55,styleName:style.name||styleId||'',centered:wordValue(pPr?.getElementsByTagNameNS(ns,'jc')[0],ns)==='center'};
}
async function parseDocx(file){
  if(!window.JSZip)throw new Error('Das DOCX-Modul konnte nicht geladen werden.');
  const zip=await JSZip.loadAsync(await file.arrayBuffer()),xml=await zip.file('word/document.xml')?.async('text'),stylesXml=await zip.file('word/styles.xml')?.async('text');
  if(!xml)throw new Error('Die DOCX-Datei enthält keinen lesbaren Dokumenttext.');
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.querySelector('parsererror'))throw new Error('Die DOCX-Struktur ist beschädigt.');
  const ns='http://schemas.openxmlformats.org/wordprocessingml/2006/main',body=doc.getElementsByTagNameNS(ns,'body')[0],styles=docxStyleMap(stylesXml,ns);
  if(!body)throw new Error('Kein Dokumentkörper gefunden.');
  const all=[],explicit=[[]];let current=explicit[0];
  for(const p of [...body.children].filter(node=>node.localName==='p')){
    const before=p.getElementsByTagNameNS(ns,'pageBreakBefore').length>0;
    if(before&&current.length){current=[];explicit.push(current)}
    const line=docxParagraph(p,styles,ns);
    if(line.text){all.push(line);current.push(line)}
    const pageBreak=[...p.getElementsByTagNameNS(ns,'br')].some(node=>(node.getAttributeNS(ns,'type')||node.getAttribute('w:type'))==='page');
    if(pageBreak&&current.length){current=[];explicit.push(current)}
  }
  const pages=logicalPages(all,file.name,explicit.filter(page=>page.length));
  return makeModel(pages,file.name.replace(/\.docx$/i,''),'DOCX');
}

function pdfFormat(item,styles){
  const style=styles[item.fontName]||{},font=`${item.fontName||''} ${style.fontFamily||''}`;
  const italic=/italic|oblique|kursiv/i.test(font)||Math.abs(item.transform?.[2]||0)>Math.abs(item.transform?.[0]||1)*.08;
  const bold=/bold|black|semibold|demi|fett/i.test(font);
  return{italic,bold};
}
function pdfRows(items,styles){
  const rows=[];
  for(const item of [...items].sort((a,b)=>Math.abs(b.transform[5]-a.transform[5])>3?b.transform[5]-a.transform[5]:a.transform[4]-b.transform[4])){
    const y=item.transform[5];let row=rows.find(candidate=>Math.abs(candidate.y-y)<3);
    if(!row){row={y,items:[]};rows.push(row)}
    row.items.push(item);
  }
  return rows.sort((a,b)=>b.y-a.y).map(row=>{
    const words=row.items.sort((a,b)=>a.transform[4]-b.transform[4]),first=words[0],second=words[1];
    const startsWithMarginNumber=first&&second&&isLineNumber(first.str)&&second.transform[4]-first.transform[4]>16;
    const content=words.slice(startsWithMarginNumber?1:0),text=withoutPdfLineNumber(content.map(item=>item.str).join(' '));
    const length=content.reduce((sum,item)=>sum+item.str.replace(/\s/g,'').length,0)||1;
    const italicWeight=content.reduce((sum,item)=>sum+(pdfFormat(item,styles).italic?item.str.replace(/\s/g,'').length:0),0);
    const boldWeight=content.reduce((sum,item)=>sum+(pdfFormat(item,styles).bold?item.str.replace(/\s/g,'').length:0),0);
    return{text,italic:italicWeight/length>=.55,bold:boldWeight/length>=.55};
  });
}
async function parsePdf(file){
  const pdf=await pdfjsLib.getDocument({data:await file.arrayBuffer()}).promise,pages=[];
  for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i),content=await page.getTextContent();pages.push(pdfRows(content.items,content.styles||{}))}
  if(pages.reduce((sum,page)=>sum+page.map(line=>line.text).join('').length,0)<50)throw new Error('Diese PDF enthält kaum auswählbaren Text. Eingescannte PDFs benötigen vorher OCR.');
  return makeModel(pages,file.name.replace(/\.pdf$/i,''),'PDF');
}

async function importFile(file){if(!file)return;stop();els.importStatus.textContent=`${file.name} wird gelesen …`;try{const name=file.name.toLowerCase();model=name.endsWith('.docx')?await parseDocx(file):name.endsWith('.pdf')?await parsePdf(file):null;if(!model)throw new Error('Bitte eine DOCX- oder PDF-Datei auswählen.');if(!model.paragraphs.length)throw new Error('Kein verwendbarer Text gefunden.');els.documentTitle.textContent=model.title;els.workspace.classList.remove('hidden');renderScript();renderNavigation();requestAnimationFrame(()=>{cacheLineOffsets();jumpToPage(1,'auto')});els.importStatus.textContent=`${model.source}: ${model.paragraphs.length} Absätze · ${model.acts.length} Akte · ${model.scenes.length} Szenen · ${model.pageCount} Seiten.`;window.__TELEPROMPTER__={getState:()=>({title:model.title,source:model.source,paragraphs:model.paragraphs.length,acts:model.acts.length,scenes:model.scenes.length,pages:model.pageCount,currentPage,playing,scrollTop:els.stage.scrollTop,presentation:document.body.classList.contains('presentation')})}}catch(error){console.error(error);els.importStatus.textContent=`Fehler: ${error.message}`}}
function appendFormattedText(node,text){
  const parts=text.split(/(\([^)]*\))/g);
  for(const part of parts){
    if(!part)continue;
    if(/^\([^)]*\)$/.test(part)){const emphasis=document.createElement('em');em.className='inline-direction';em.textContent=part;node.append(emphasis)}
    else node.append(document.createTextNode(part));
  }
}
function renderScript(){els.scriptDisplay.replaceChildren(...model.paragraphs.map(p=>{
  const n=document.createElement('p');n.className=`script-line ${p.type}${p.italic?' source-italic':''}${p.bold?' source-bold':''}`;n.dataset.index=p.index;
  if(p.type==='speaker-dialogue'){
    const name=document.createElement('strong');name.className='speaker-name';name.textContent=p.speakerPrefix;n.append(name);
    if(p.speakerStage){const stage=document.createElement('em');stage.className='speaker-stage';stage.textContent=` (${p.speakerStage})`;n.append(stage)}
    const separator=document.createElement('span');separator.className='speaker-separator';separator.textContent=' — ';n.append(separator);
    const dialogue=document.createElement('span');dialogue.className='speaker-text';appendFormattedText(dialogue,p.dialogueText);n.append(dialogue);
  }else appendFormattedText(n,p.text);
  return n;
}))}
function renderNavigation(){const source=navMode==='acts'?model.acts:navMode==='scenes'?model.scenes:model.pages;els.navigationList.replaceChildren(...source.map(item=>{const b=document.createElement('button');b.type='button';b.textContent=navMode==='pages'?`Seite ${item.page}`:item.text;b.addEventListener('click',()=>navMode==='pages'?jumpToPage(item.page):jumpToIndex(item.index));return b}))}
function cacheLineOffsets(){if(!model)return;lineOffsets=[...els.scriptDisplay.children].map(n=>n.offsetTop);updatePosition()}
function scheduleLayoutCache(){if(layoutFrame)return;layoutFrame=requestAnimationFrame(()=>{layoutFrame=0;cacheLineOffsets()})}
function schedulePositionUpdate(){if(positionFrame)return;positionFrame=requestAnimationFrame(()=>{positionFrame=0;updatePosition()})}
function centeredIndex(){return model&&lineOffsets.length?activeParagraphAt(els.stage.scrollTop+els.stage.clientHeight/2)?.index:null}
function restoreCenteredIndex(index){if(index===null||index===undefined)return;cacheLineOffsets();const n=els.scriptDisplay.querySelector(`[data-index="${index}"]`);if(!n)return;const max=Math.max(0,els.stage.scrollHeight-els.stage.clientHeight);const top=Math.max(0,Math.min(max,(lineOffsets[index]??n.offsetTop)-els.stage.clientHeight/2));els.stage.scrollTop=top;scrollPosition=top;updatePosition()}
function restoreAfterLayout(index){requestAnimationFrame(()=>requestAnimationFrame(()=>restoreCenteredIndex(index)))}
function jumpToIndex(index,behavior='smooth'){const n=els.scriptDisplay.querySelector(`[data-index="${index}"]`);if(n){stop();const top=Math.max(0,(lineOffsets[index]??n.offsetTop)-els.stage.clientHeight/2);scrollPosition=top;els.stage.scrollTo({top,behavior})}}
function jumpToPage(page,behavior='smooth'){if(!model)return;currentPage=Math.max(1,Math.min(model.pageCount,Number(page)||1));jumpToIndex(model.pages[currentPage-1].firstIndex,behavior);schedulePositionUpdate()}
function activeParagraphAt(position){let low=0,high=lineOffsets.length-1,active=0;while(low<=high){const middle=(low+high)>>1;if(lineOffsets[middle]<=position){active=middle;low=middle+1}else high=middle-1}return model.paragraphs[active]||model.paragraphs[0]}
function updatePosition(){if(!model)return;const active=activeParagraphAt(els.stage.scrollTop+els.stage.clientHeight/2);currentPage=active?.page||1;els.pageText.textContent=`Seite ${currentPage}`;els.locationText.textContent=[active?.act,active?.scene].filter(Boolean).join(' · ')||model.title;const max=Math.max(1,els.stage.scrollHeight-els.stage.clientHeight);els.progressText.textContent=`${Math.round(els.stage.scrollTop/max*100)} %`}
function stop(){playing=false;cancelAnimationFrame(animation);animation=0;scrollPosition=els.stage?.scrollTop||0;if(els.playButton)els.playButton.textContent='Start'}
function togglePlay(){if(!model)return;if(playing){stop();return}const max=Math.max(0,els.stage.scrollHeight-els.stage.clientHeight);if(els.stage.scrollTop>=max-1){els.stage.scrollTop=0;scrollPosition=0}playing=true;els.playButton.textContent='Pause';scrollPosition=els.stage.scrollTop;lastTime=performance.now();animation=requestAnimationFrame(frame)}
function frame(now){if(!playing)return;const dt=Math.min((now-lastTime)/1000,0.1);lastTime=now;scrollPosition+=Number(els.speedInput.value)*dt;const max=Math.max(0,els.stage.scrollHeight-els.stage.clientHeight);if(scrollPosition>=max){els.stage.scrollTop=max;schedulePositionUpdate();stop();return}els.stage.scrollTop=scrollPosition;schedulePositionUpdate();animation=requestAnimationFrame(frame)}
function skip(seconds){stop();scrollPosition=Math.max(0,Math.min(els.stage.scrollHeight-els.stage.clientHeight,els.stage.scrollTop+Number(els.speedInput.value)*seconds));els.stage.scrollTop=scrollPosition;schedulePositionUpdate()}
function controls(){els.speedValue.textContent=els.speedInput.value;els.fontValue.textContent=els.fontInput.value;els.lineHeightValue.textContent=Number(els.lineHeightInput.value).toFixed(2);els.scriptDisplay.style.fontSize=`${els.fontInput.value}px`;els.scriptDisplay.style.lineHeight=els.lineHeightInput.value;scheduleLayoutCache()}
function setPresentation(active){if(document.body.classList.contains('presentation')===active)return null;const index=centeredIndex();document.body.classList.toggle('presentation',active);els.fullscreenButton.textContent=active?'Vollbild verlassen':'Vollbild';restoreAfterLayout(index);return index}
async function presentation(){if(document.body.classList.contains('presentation')){setPresentation(false);if(document.fullscreenElement)await document.exitFullscreen().catch(()=>{});return}const index=setPresentation(true);if(document.fullscreenEnabled&&document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen().catch(()=>{});restoreAfterLayout(index)}}

els.fileInput.addEventListener('change',()=>importFile(els.fileInput.files[0]));els.tabs.forEach(tab=>tab.addEventListener('click',()=>{navMode=tab.dataset.mode;els.tabs.forEach(t=>t.classList.toggle('active',t===tab));renderNavigation()}));els.previousButton.addEventListener('click',()=>jumpToPage(currentPage-1));els.nextButton.addEventListener('click',()=>jumpToPage(currentPage+1));els.rewindButton.addEventListener('click',()=>skip(-10));els.forwardButton.addEventListener('click',()=>skip(10));els.playButton.addEventListener('click',togglePlay);[els.speedInput,els.fontInput,els.lineHeightInput].forEach(i=>i.addEventListener('input',controls));els.stage.addEventListener('scroll',()=>{if(!playing)scrollPosition=els.stage.scrollTop;schedulePositionUpdate()},{passive:true});els.themeButton.addEventListener('click',()=>{document.body.classList.toggle('light');els.themeButton.textContent=document.body.classList.contains('light')?'Dunkler Modus':'Heller Modus'});els.fullscreenButton.addEventListener('click',presentation);els.exitPresentationButton.addEventListener('click',presentation);document.addEventListener('fullscreenchange',()=>{if(document.fullscreenElement){nativeFullscreenObserved=true;return}if(nativeFullscreenObserved){nativeFullscreenObserved=false;setPresentation(false)}});window.addEventListener('keydown',e=>{if(e.target.matches('input'))return;if(e.code==='Space'){e.preventDefault();togglePlay()}if(e.key==='ArrowRight')jumpToPage(currentPage+1);if(e.key==='ArrowLeft')jumpToPage(currentPage-1);if(e.key.toLowerCase()==='f')presentation();if(e.key==='Escape'&&document.body.classList.contains('presentation')&&!document.fullscreenElement)setPresentation(false)});controls();
