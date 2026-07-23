import test from'node:test';
import assert from'node:assert/strict';
import{makeModel,isLineNumber,withoutPdfLineNumber}from'../classification.js';

const types=lines=>makeModel([lines],'Test','DOCX').paragraphs.map(({text,type})=>[text,type]);

test('recognises repeated mixed-case character names',()=>{
  assert.deepEqual(types(['Franz.','Erste Replik.','Franz.','Zweite Replik.']),[
    ['Franz.','speaker'],
    ['Erste Replik.','dialogue'],
    ['Franz.','speaker'],
    ['Zweite Replik.','dialogue'],
  ]);
});

test('recognises abbreviated names and speaker stage directions',()=>{
  assert.deepEqual(types(['D. a. Moor.','Was werde ich hören?','D. a. Moor (weint bitterlich).','Mein Name!']),[
    ['D. a. Moor.','speaker'],
    ['Was werde ich hören?','dialogue'],
    ['D. a. Moor (weint bitterlich).','speaker'],
    ['Mein Name!','dialogue'],
  ]);
});

test('splits character names and stage directions from inline dialogue',()=>{
  const model=makeModel([[
    'Franz.',
    'Eine erste Replik.',
    'Franz.',
    'Eine zweite Replik.',
    'Franz (nimmt den Brief). Das ist die Nachricht.',
  ]],'Test','DOCX');
  const paragraph=model.paragraphs.at(-1);
  assert.equal(paragraph.type,'speaker-dialogue');
  assert.equal(paragraph.speakerPrefix,'Franz');
  assert.equal(paragraph.speakerStage,'nimmt den Brief');
  assert.equal(paragraph.dialogueText,'Das ist die Nachricht.');
});

test('uses source formatting without turning ordinary dialogue into speakers',()=>{
  assert.deepEqual(types([
    {text:'Franz',bold:true},
    {text:'Sprich endlich.'},
    {text:'Er geht langsam zur Tür.',italic:true},
  ]),[
    ['Franz','speaker'],
    ['Sprich endlich.','dialogue'],
    ['Er geht langsam zur Tür.','direction'],
  ]);
});

test('keeps scene-setting lines together and avoids uppercase dialogue false positives',()=>{
  assert.deepEqual(types([
    'Erster Akt',
    '1. Szene',
    'Saal im Moorischen Schloss.',
    'Franz, der alte Moor.',
    'FRANZ.',
    'ICH BIN NICHT EINVERSTANDEN.',
    'FRANZ.',
    'Dann geh!',
  ]),[
    ['Erster Akt','act'],
    ['1. Szene','scene'],
    ['Saal im Moorischen Schloss.','setting'],
    ['Franz, der alte Moor.','setting'],
    ['FRANZ.','speaker'],
    ['ICH BIN NICHT EINVERSTANDEN.','dialogue'],
    ['FRANZ.','speaker'],
    ['Dann geh!','dialogue'],
  ]);
});

test('removes only valid theatre line numbers',()=>{
  assert.equal(isLineNumber('Zeile 20'),true);
  assert.equal(isLineNumber('21'),false);
  assert.equal(withoutPdfLineNumber('20 FRANZ'),'FRANZ');
});
