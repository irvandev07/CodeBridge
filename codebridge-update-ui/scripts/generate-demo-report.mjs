import { writeFile } from 'node:fs/promises';
import { renderHtml } from '../dist/reports/html.js';
const report = {
 schemaVersion:'1.3',toolVersion:'0.5.0',generatedAt:new Date().toISOString(),repository:'acme/auth-service',baseRef:'main',commitSha:'4a85b7d29533fe04816c2048baccb19be2e8',
 changedFiles:['src/auth/login.ts','tests/auth/login.test.ts','src/auth/lockout.ts'],
 changeDetails:[{path:'src/auth/login.ts',status:'modified',additions:82,deletions:21},{path:'tests/auth/login.test.ts',status:'modified',additions:56,deletions:9},{path:'src/auth/lockout.ts',status:'added',additions:34,deletions:0}],
 criteria:[
  {id:'AC-001',description:'Users can sign in with a valid email and password',status:'verified',explanation:'An explicitly mapped TAP test passed in a successful check.',evidence:[{id:'E-1',criterionId:'AC-001',kind:'test',status:'pass',description:'Authentication happy-path test completed successfully.',checkId:'test',testName:'auth > accepts valid credentials',provenance:'tap'}]},
  {id:'AC-002',description:'Invalid passwords are rejected with a safe error',status:'verified',explanation:'The corresponding negative-path test passed.',evidence:[{id:'E-2',criterionId:'AC-002',kind:'test',status:'pass',description:'Invalid password produces an unauthorized response.',checkId:'test',testName:'auth > rejects invalid passwords',provenance:'tap'}]},
  {id:'AC-003',description:'Account is locked after five unsuccessful attempts',status:'unverified',explanation:'No qualifying test result is linked to the lockout threshold.',evidence:[]},
  {id:'AC-004',description:'Existing sessions continue to function after deployment',status:'partial',explanation:'Static checks pass, but no session continuity integration test is mapped.',evidence:[{id:'E-4',criterionId:'AC-004',kind:'static',status:'pass',description:'TypeScript compilation completed successfully.',checkId:'typecheck',provenance:'manifest'}]}
 ],
 checks:[{id:'lint',status:'passed',durationMs:1082,output:'✓ ESLint completed with no errors'},{id:'typecheck',status:'passed',durationMs:1520,output:'✓ TypeScript compilation passed'},{id:'test',status:'passed',durationMs:2147,output:'TAP version 13\nok 1 - auth > accepts valid credentials\nok 2 - auth > rejects invalid passwords\n1..2\n# pass 2'}],
 testCases:[{id:'T-1',checkId:'test',name:'auth > accepts valid credentials',status:'passed',source:'tap',occurrence:1},{id:'T-2',checkId:'test',name:'auth > rejects invalid passwords',status:'passed',source:'tap',occurrence:1}],
 evidenceGraph:{nodes:[{id:'AC-001',type:'criterion',label:'Users can sign in',status:'verified'},{id:'AC-002',type:'criterion',label:'Invalid passwords are rejected',status:'verified'},{id:'AC-003',type:'criterion',label:'Account lockout',status:'unverified'},{id:'AC-004',type:'criterion',label:'Session continuity',status:'partial'},{id:'T-1',type:'test',label:'auth > accepts valid credentials',status:'passed'},{id:'T-2',type:'test',label:'auth > rejects invalid passwords',status:'passed'},{id:'test',type:'check',label:'test',status:'passed'},{id:'src/auth/login.ts',type:'file',label:'src/auth/login.ts'}],edges:[{from:'AC-001',to:'T-1',relation:'validated-by'},{from:'AC-002',to:'T-2',relation:'validated-by'},{from:'T-1',to:'test',relation:'observed-in'},{from:'T-2',to:'test',relation:'observed-in'},{from:'AC-001',to:'src/auth/login.ts',relation:'references'}]},
 findings:[{id:'F-01',ruleId:'missing-lockout-test',title:'Account lockout threshold lacks test coverage',message:'Add an integration test asserting that the fifth failed sign-in triggers lockout and subsequent attempts are blocked.',severity:'medium',source:'deterministic',file:'src/auth/lockout.ts',line:18}],
 decision:'review',summary:{totalCriteria:4,verified:2,partial:1,unverified:1,conflict:0,changedFiles:3,addedLines:172,deletedLines:30,findingsBySeverity:{critical:0,high:0,medium:1,low:0,info:0}}
};
const output=new URL('../examples/premium-report.html',import.meta.url);
await writeFile(output,renderHtml(report),'utf8');
console.log(`Generated ${output.pathname}`);
