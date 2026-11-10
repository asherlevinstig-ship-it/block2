import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function testDatabase(){
  const sql=new DatabaseSync(':memory:');
  for(const name of ['0001_players.sql','0002_accounts.sql','0003_factions.sql','0004_faction_founding_fee.sql','0005_faction_projects.sql'])sql.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  const db={prepare(query){let values=[];return {bind(...args){values=args;return this;},async first(){return sql.prepare(query).get(...values)??null;},async run(){const result=sql.prepare(query).run(...values);return {success:true,meta:{changes:Number(result.changes)}};},async all(){return {results:sql.prepare(query).all(...values)};}};}};
  return {db,sql};
}
