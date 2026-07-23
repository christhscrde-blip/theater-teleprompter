import test from'node:test';
import assert from'node:assert/strict';
import{readFile}from'node:fs/promises';

const root=new URL('../',import.meta.url);
const [html,css,app]=await Promise.all([
  readFile(new URL('index.html',root),'utf8'),
  readFile(new URL('styles.css',root),'utf8'),
  readFile(new URL('app.js',root),'utf8'),
]);

test('all V2 controls exist once and are wired in JavaScript',()=>{
  const ids=[
    'toggleSidebarButton','roleSelect','progressInput','sceneMarkers',
    'focusButton','roleColorsButton','wakeLockButton','presentationControls',
    'presentationPlayButton','presentationProgressInput',
  ];
  for(const id of ids){
    assert.equal((html.match(new RegExp(`id="${id}"`,'g'))||[]).length,1,`${id} must exist once`);
    assert.match(app,new RegExp(`\\$\\('#${id}'\\)`),`${id} must be wired`);
  }
});

test('presentation mode uses the full viewport and keeps a visible exit',()=>{
  assert.match(css,/body\.presentation \.stage\{[^}]*width:100vw[^}]*height:100(?:vh|dvh)/s);
  assert.match(css,/body\.presentation \.script-display\{[^}]*max-width:none/s);
  assert.match(css,/body\.presentation \.exit-presentation\{display:block\}/);
  assert.doesNotMatch(css,/presentation-ui-hidden \.exit-presentation/);
});

test('V2 includes presets, focus, roles, persistence, drag and wake lock',()=>{
  for(const feature of[
    'const PRESETS=','focus-reading','role-colors','localStorage','dragover',
    'wakeLock.request','renderSceneMarkers','scheduleDocumentState',
  ])assert.ok(app.includes(feature),`missing ${feature}`);
  for(const preset of['probe','buehne','beamer','entfernung'])assert.match(html,new RegExp(`data-preset="${preset}"`));
});
