// src/scripts/backup.js
// Script para backup completo do servidor (banco de dados PostgreSQL + arquivos)
// Não requer pg_dump instalado - usa Sequelize diretamente

const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const { Sequelize, QueryTypes } = require('sequelize');
const fs = require('fs');
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

// Escapa valor para SQL
function escapeSqlValue(value) {
    if (value === null || value === undefined) {
        return 'NULL';
    }
    if (typeof value === 'boolean') {
        return value ? 'TRUE' : 'FALSE';
    }
    if (typeof value === 'number') {
        return value.toString();
    }
    if (value instanceof Date) {
        return `'${value.toISOString()}'`;
    }
    if (typeof value === 'object') {
        return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
    }
    return `'${String(value).replace(/'/g, "''")}'`;
}

// Backup do banco de dados via Sequelize
async function backupDatabase(timestamp) {
    const backupFile = path.join(BACKUP_DIR, `db_backup_${timestamp}.sql`);

    console.log('🔄 Iniciando backup do banco de dados...');
    console.log(`   Host: ${DB_CONFIG.host}:${DB_CONFIG.port}`);
    console.log(`   Database: ${DB_CONFIG.database}`);

    const sequelize = new Sequelize(
        DB_CONFIG.database,
        DB_CONFIG.user,
        DB_CONFIG.password,
        {
            host: DB_CONFIG.host,
            port: DB_CONFIG.port,
            dialect: 'postgres',
            logging: false,
            dialectOptions: {
                ssl: process.env.DB_SSL === 'true' ? { require: true, rejectUnauthorized: false } : false
            }
        }
    );

    try {
        await sequelize.authenticate();
        console.log('   ✓ Conexão estabelecida com sucesso');

        let sqlContent = `-- Backup do banco de dados: ${DB_CONFIG.database}\n`;
        sqlContent += `-- Data: ${new Date().toISOString()}\n`;
        sqlContent += `-- Host: ${DB_CONFIG.host}:${DB_CONFIG.port}\n\n`;

        // Obter todas as tabelas
        const tables = await sequelize.query(
            `SELECT tablename FROM pg_tables WHERE schemaname = 'public'`,
            { type: QueryTypes.SELECT }
        );

        console.log(`   Encontradas ${tables.length} tabelas`);

        for (const { tablename } of tables) {
            console.log(`   → Exportando: ${tablename}`);

            // Obtém estrutura da tabela
            const columns = await sequelize.query(
                `SELECT column_name, data_type, is_nullable, column_default 
         FROM information_schema.columns 
         WHERE table_name = '${tablename}' AND table_schema = 'public'
         ORDER BY ordinal_position`,
                { type: QueryTypes.SELECT }
            );

            // Cria DROP TABLE e CREATE TABLE
            sqlContent += `\n-- Tabela: ${tablename}\n`;
            sqlContent += `DROP TABLE IF EXISTS "${tablename}" CASCADE;\n`;
            sqlContent += `CREATE TABLE "${tablename}" (\n`;

            const colDefs = columns.map(col => {
                let def = `  "${col.column_name}" ${col.data_type.toUpperCase()}`;
                if (col.is_nullable === 'NO') def += ' NOT NULL';
                if (col.column_default) def += ` DEFAULT ${col.column_default}`;
                return def;
            });

            sqlContent += colDefs.join(',\n');
            sqlContent += '\n);\n\n';

            // Obtém dados da tabela
            const rows = await sequelize.query(
                `SELECT * FROM "${tablename}"`,
                { type: QueryTypes.SELECT }
            );

            if (rows.length > 0) {
                const columnNames = Object.keys(rows[0]);

                for (const row of rows) {
                    const values = columnNames.map(col => escapeSqlValue(row[col]));
                    sqlContent += `INSERT INTO "${tablename}" ("${columnNames.join('", "')}") VALUES (${values.join(', ')});\n`;
                }

                console.log(`     ${rows.length} registros exportados`);
            }
        }

        // Salva o arquivo SQL
        fs.writeFileSync(backupFile, sqlContent, 'utf8');

        const stats = fs.statSync(backupFile);
        console.log(`\n✅ Backup do banco concluído: ${backupFile}`);
        console.log(`   Tamanho: ${(stats.size / 1024).toFixed(2)} KB`);

        await sequelize.close();
        return backupFile;

    } catch (error) {
        console.error('❌ Erro no backup do banco:', error.message);
        await sequelize.close();
        throw error;
    }
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
            console.log(`\n✅ Backup dos arquivos concluído: ${backupFile}`);
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

// Move backup para pasta public
function moveToPublic(backupPath) {
    if (!fs.existsSync(PUBLIC_DIR)) {
        fs.mkdirSync(PUBLIC_DIR, { recursive: true });
    }

    const destPath = path.join(PUBLIC_DIR, path.basename(backupPath));
    fs.copyFileSync(backupPath, destPath);
    console.log(`📁 Backup copiado para public: ${destPath}`);
    return destPath;
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
    const {
        includeFiles = true,
        includeDatabase = true,
        cleanOld = true,
        daysToKeep = 7,
        copyToPublic = false
    } = options;

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

            // Copia para pasta public se solicitado
            if (copyToPublic) {
                moveToPublic(fullBackupPath);
            }

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
        copyToPublic: args.includes('--public'),
        daysToKeep: parseInt(args.find(a => a.startsWith('--days='))?.split('=')[1]) || 7
    };

    runBackup(options)
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
}

// Exporta para uso como módulo
module.exports = { runBackup, backupDatabase, backupPublicFiles, cleanOldBackups };
