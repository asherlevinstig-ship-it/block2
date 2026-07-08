const fs=require('node:fs');
const path=require('node:path');
const RECALL=require('../shared/recall-system');

function main(){
  const file=process.argv[2];
  if(!file){console.error('Usage: node scripts/validate-question-bank.js <bank.json>');process.exitCode=2;return;}
  let bank;
  try{bank=JSON.parse(fs.readFileSync(path.resolve(file),'utf8'));}
  catch(error){console.error('Could not read question bank: '+error.message);process.exitCode=2;return;}
  if(!Array.isArray(bank)){console.error('Question bank must be a JSON array.');process.exitCode=1;return;}
  const errors=RECALL.validateQuestionBank(bank);
  for(const q of bank)if(!['teacher-reviewed','approved'].includes(q&&q.reviewStatus))errors.push('Question '+(q&&q.id||'?')+' is not teacher-reviewed');
  if(errors.length){console.error(errors.join('\n'));process.exitCode=1;return;}
  console.log('Valid question bank: '+bank.length+' reviewed questions.');
}

main();
