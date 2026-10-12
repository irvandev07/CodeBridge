import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderHtml } from '../dist/reports/html.js';

const fixture = {
  schemaVersion:'1.3',toolVersion:'0.5.0',generatedAt:'2026-10-13T00:00:00.000Z',repository:'codebridge',baseRef:'main',commitSha:'abcdef1234567890',
  changedFiles:['src/auth.ts'],changeDetails:[{path:'src/auth.ts',status:'modified',additions:20,deletions:3}],
  criteria:[{id:'AC-1',description:'Reject invalid passwords',status:'verified',explanation:'Linked test passed', evidence:[{id:'ev-1',criterionId:'AC-1',kind:'test',status:'pass',description:'Invalid password test',testName:'rejects invalid passwords',checkId:'test',provenance:'tap'}]}],
  checks:[{id:'test',status:'passed',durationMs:123,output:'ok 1 - rejects invalid passwords'}],
  findings:[],decision:'pass',testCases:[{id:'t1',checkId:'test',name:'rejects invalid passwords',status:'passed',source:'tap',occurrence:1}],
  evidenceGraph:{nodes:[{id:'AC-1',type:'criterion',label:'Reject invalid passwords'},{id:'t1',type:'test',label:'rejects invalid passwords'}],edges:[{from:'AC-1',to:'t1',relation:'validated-by'}]},
  summary:{totalCriteria:1,verified:1,partial:0,unverified:0,conflict:0,changedFiles:1,addedLines:20,deletedLines:3,findingsBySeverity:{critical:0,high:0,medium:0,low:0,info:0}}
};

test('premium dashboard includes accessible navigation, evidence and offline CSP',()=>{
  const html=renderHtml(fixture);
  for(const fragment of ['id="overview"','id="criteria"','id="evidence"','id="tests"','id="findings"','id="changes"','id="checks"','Verification overview','rejects invalid passwords','default-src \'none\'','prefers-reduced-motion']) assert.ok(html.includes(fragment),fragment);
  assert.ok(!html.includes('<script'));
  assert.ok(!html.includes('https://'));
});
test('premium dashboard escapes untrusted evidence, filenames and text',()=>{
  const altered=structuredClone(fixture);
  altered.criteria[0].description='<img src=x onerror=alert(1)>';
  altered.criteria[0].evidence[0].description='</summary><script>attack()</script>';
  altered.changeDetails[0].path='<svg/onload=alert(1)>';
  const html=renderHtml(altered);
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&lt;script&gt;attack()&lt;/script&gt;'));
  assert.ok(!html.includes('<svg/onload'));
});
test('zero-count reports render safely',()=>{
  const altered=structuredClone(fixture);
  altered.criteria=[];altered.checks=[];altered.testCases=[];altered.evidenceGraph=undefined;
  const html=renderHtml(altered);
  assert.ok(html.includes('0<em>%</em>'));
  assert.ok(html.includes('No acceptance criteria'));
});
