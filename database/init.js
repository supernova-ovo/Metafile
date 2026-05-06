import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import initSqlJs from 'sql.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'metafile.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

async function main() {
  console.log('[init] 初始化 MetaFile SQLite 数据库...\n');

  const SQL = await initSqlJs();

  let tryMigrate = false;
  if (fs.existsSync(DB_PATH)) {
    console.log(`[init] 发现已有数据库文件: ${DB_PATH}`);
    const oldBuf = fs.readFileSync(DB_PATH);
    const oldDb = new SQL.Database(oldBuf);
    const tables = oldDb.exec("SELECT name FROM sqlite_master WHERE type='table'");
    if (tables.length > 0) {
      console.log(`[init] 已有 ${tables[0].values.length} 个表，跳过初始化`);
      oldDb.close();
      return;
    }
    oldDb.close();
    tryMigrate = true;
  }

  const db = new SQL.Database();

  // Enable WAL mode and foreign keys
  db.run('PRAGMA journal_mode=WAL;');
  db.run('PRAGMA foreign_keys=ON;');

  // Read and execute schema
  const schemaSQL = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.run(schemaSQL);

  console.log('[init] Schema 执行完成');

  // Verify tables
  const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name");
  console.log(`\n[init] 已创建 ${tables[0].values.length} 个表:`);
  for (const [name] of tables[0].values) {
    const count = db.exec(`SELECT COUNT(*) FROM "${name}"`);
    console.log(`  - ${name}: ${count[0].values[0][0]} 行`);
  }

  // Save database to file
  const buffer = Buffer.from(db.export());
  fs.writeFileSync(DB_PATH, buffer);
  console.log(`\n[init] 数据库已写入: ${DB_PATH} (${(buffer.length / 1024).toFixed(1)} KB)`);

  db.close();
  console.log('[init] 完成\n');
}

main().catch(err => {
  console.error('[init] 失败:', err);
  process.exit(1);
});
