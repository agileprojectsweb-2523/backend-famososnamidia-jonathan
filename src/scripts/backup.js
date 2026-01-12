// src/scripts/backup.js
// Script para backup completo do servidor (banco de dados PostgreSQL + arquivos)
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Configurações
const BACKUP_DIR = path.join(__dirname, '../../backups');
const PUBLIC_DIR = path.join(__dirname, '../../public');

// Configurações do banco de dados
const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
};

// Gera timestamp para nome do backup
function getTimestamp() {
  const now = new Date();
  return now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

// Cria diretório de backup se não existir
function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`📁 Diretório de backup criado: ${BACKUP_DIR}`);
  }
}

// Backup do banco de dados PostgreSQL
function backupDatabase(timestamp) {
  return new Promise((resolve, reject) => {
    const backupFile = path.join(BACKUP_DIR, `db_backup_${timestamp}.sql`);
    
    // Define a senha via variável de ambiente
    const env = { ...process.env, PGPASSWORD: DB_CONFIG.password };
    
    const cmd = `pg_dump -h ${DB_CONFIG.host} -p ${DB_CONFIG.port} -U ${DB_CONFIG.user} -d ${DB_CONFIG.database} -F p -f "${backupFile}"`;
    
    console.log('🔄 Iniciando backup do banco de dados...');
    console.log(`   Host: ${DB_CONFIG.host}:${DB_CONFIG.port}`);
    console.log(`   Database: ${DB_CONFIG.database}`);
    
    exec(cmd, { env }, (error, stdout, stderr) => {
      if (error) {
        console.error('❌ Erro no backup do banco:', error.message);
        reject(error);
        return;
      }
      
      if (stderr && !stderr.includes('NOTICE')) {
        console.warn('⚠️ Aviso pg_dump:', stderr);
      }
      
      const stats = fs.statSync(backupFile);
      console.log(`✅ Backup do banco concluído: ${backupFile}`);
      console.log(`   Tamanho: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
      
      resolve(backupFile);
    });
  });
}

// Backup dos arquivos públicos (uploads)
function backupPublicFiles(timestamp) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(PUBLIC_DIR)) {
      console.log('⚠️ Pasta public não encontrada, pulando backup de arquivos...');
      resolve(null);
      return;
    }
    
    const backupFile = path.join(BACKUP_DIR, `files_backup_${timestamp}.zip`);
    const output = fs.createWriteStream(backupFile);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    console.log('🔄 Iniciando backup dos arquivos públicos...');
    
    output.on('close', () => {
      console.log(`✅ Backup dos arquivos concluído: ${backupFile}`);
      console.log(`   Tamanho: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
      resolve(backupFile);
    });
    
    archive.on('error', (err) => {
      console.error('❌ Erro no backup dos arquivos:', err.message);
      reject(err);
    });
    
    archive.on('progress', (progress) => {
      process.stdout.write(`\r   Processados: ${progress.entries.processed}/${progress.entries.total} arquivos`);
    });
    
    archive.pipe(output);
    archive.directory(PUBLIC_DIR, 'public');
    archive.finalize();
  });
}

// Cria backup completo (DB + Arquivos em um único ZIP)
function createFullBackup(dbBackupPath, filesBackupPath, timestamp) {
  return new Promise((resolve, reject) => {
    const fullBackupFile = path.join(BACKUP_DIR, `full_backup_${timestamp}.zip`);
    const output = fs.createWriteStream(fullBackupFile);
    const archive = archiver('zip', { zlib: { level: 9 } });
    
    console.log('\n🔄 Criando backup completo...');
    
    output.on('close', () => {
      console.log(`✅ Backup completo criado: ${fullBackupFile}`);
      console.log(`   Tamanho total: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
      
      // Remove arquivos temporários
      if (dbBackupPath && fs.existsSync(dbBackupPath)) {
        fs.unlinkSync(dbBackupPath);
        console.log('🗑️ Arquivo temporário do banco removido');
      }
      if (filesBackupPath && fs.existsSync(filesBackupPath)) {
        fs.unlinkSync(filesBackupPath);
        console.log('🗑️ Arquivo temporário dos arquivos removido');
      }
      
      resolve(fullBackupFile);
    });
    
    archive.on('error', (err) => {
      console.error('❌ Erro ao criar backup completo:', err.message);
      reject(err);
    });
    
    archive.pipe(output);
    
    if (dbBackupPath && fs.existsSync(dbBackupPath)) {
      archive.file(dbBackupPath, { name: path.basename(dbBackupPath) });
    }
    if (filesBackupPath && fs.existsSync(filesBackupPath)) {
      archive.file(filesBackupPath, { name: path.basename(filesBackupPath) });
    }
    
    archive.finalize();
  });
}

// Limpa backups antigos (mantém últimos N dias)
function cleanOldBackups(daysToKeep = 7) {
  console.log(`\n🧹 Limpando backups com mais de ${daysToKeep} dias...`);
  
  const files = fs.readdirSync(BACKUP_DIR);
  const now = Date.now();
  const maxAge = daysToKeep * 24 * 60 * 60 * 1000;
  let deletedCount = 0;
  
  files.forEach(file => {
    const filePath = path.join(BACKUP_DIR, file);
    const stats = fs.statSync(filePath);
    
    if (now - stats.mtime.getTime() > maxAge) {
      fs.unlinkSync(filePath);
      deletedCount++;
      console.log(`   Removido: ${file}`);
    }
  });
  
  if (deletedCount === 0) {
    console.log('   Nenhum backup antigo para remover');
  } else {
    console.log(`   ${deletedCount} backup(s) antigo(s) removido(s)`);
  }
}

// Função principal de backup
async function runBackup(options = {}) {
  const { includeFiles = true, includeDatabase = true, cleanOld = true, daysToKeep = 7 } = options;
  
  console.log('═══════════════════════════════════════════');
  console.log('   BACKUP COMPLETO DO SERVIDOR');
  console.log('   Data:', new Date().toLocaleString('pt-BR'));
  console.log('═══════════════════════════════════════════\n');
  
  try {
    // Verifica configurações do banco
    if (includeDatabase && (!DB_CONFIG.database || !DB_CONFIG.user)) {
      throw new Error('Configurações do banco de dados não encontradas. Verifique o arquivo .env');
    }
    
    ensureBackupDir();
    const timestamp = getTimestamp();
    
    let dbBackupPath = null;
    let filesBackupPath = null;
    
    // Backup do banco de dados
    if (includeDatabase) {
      try {
        dbBackupPath = await backupDatabase(timestamp);
      } catch (dbError) {
        console.error('❌ Falha no backup do banco de dados:', dbError.message);
        console.log('   Continuando com backup dos arquivos...\n');
      }
    }
    
    // Backup dos arquivos públicos
    if (includeFiles) {
      try {
        filesBackupPath = await backupPublicFiles(timestamp);
      } catch (fileError) {
        console.error('❌ Falha no backup dos arquivos:', fileError.message);
      }
    }
    
    // Cria backup completo se temos pelo menos um dos backups
    if (dbBackupPath || filesBackupPath) {
      const fullBackupPath = await createFullBackup(dbBackupPath, filesBackupPath, timestamp);
      
      // Limpa backups antigos
      if (cleanOld) {
        cleanOldBackups(daysToKeep);
      }
      
      console.log('\n═══════════════════════════════════════════');
      console.log('   ✅ BACKUP CONCLUÍDO COM SUCESSO!');
      console.log('   Arquivo:', fullBackupPath);
      console.log('═══════════════════════════════════════════\n');
      
      return fullBackupPath;
    } else {
      throw new Error('Nenhum backup foi criado');
    }
    
  } catch (error) {
    console.error('\n═══════════════════════════════════════════');
    console.error('   ❌ ERRO NO BACKUP');
    console.error('   ', error.message);
    console.error('═══════════════════════════════════════════\n');
    throw error;
  }
}

// Execução via CLI
if (require.main === module) {
  const args = process.argv.slice(2);
  
  const options = {
    includeFiles: !args.includes('--no-files'),
    includeDatabase: !args.includes('--no-db'),
    cleanOld: !args.includes('--no-clean'),
    daysToKeep: parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1]) || 7
  };
  
  runBackup(options)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

// Exporta para uso como módulo
module.exports = { runBackup, backupDatabase, backupPublicFiles, cleanOldBackups };
