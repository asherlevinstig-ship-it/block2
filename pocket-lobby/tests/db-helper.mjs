import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
export function testDatabase(){
  const sql=new DatabaseSync(':memory:');
  for(const name of ['0001_players.sql','0002_accounts.sql','0003_factions.sql','0004_faction_founding_fee.sql','0005_faction_projects.sql','0006_shared_trees.sql','0007_guild_feast.sql','0008_mill_raid.sql','0009_timber_orders.sql','0010_trail_camp.sql','0011_mining.sql','0012_liveweave_login.sql','0013_vault_coop.sql','0014_public_requests.sql','0015_silverfin_watch.sql','0016_silverfin_pairs.sql','0017_silverfin_supper.sql','0018_gifts.sql','0019_waystation.sql','0020_waystation_credits.sql'])sql.exec(readFileSync(new URL('../migrations/'+name,import.meta.url),'utf8'));
  const db={prepare(query){let values=[];return {bind(...args){values=args;return this;},async first(){return sql.prepare(query).get(...values)??null;},async run(){const result=sql.prepare(query).run(...values);return {success:true,meta:{changes:Number(result.changes)}};},all(){return {results:sql.prepare(query).all(...values)};}};}};
  db.batch=async statements=>{sql.exec('BEGIN');try{const results=statements.map(statement=>statement.all());sql.exec('COMMIT');return results;}catch(error){sql.exec('ROLLBACK');throw error;}};
  return {db,sql};
}
