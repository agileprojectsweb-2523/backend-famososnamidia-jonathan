// src/app.js (no backend)
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { schedulePostPublisher } = require('./src/jobs/scheduler'); // Ajuste o caminho se necessário

// Carrega variáveis de .env para process.env o mais cedo possível
dotenv.config();

// Importa configurações e outros módulos APÓS carregar .env
const configModule = require('./src/config/config');
const allRoutes = require('./src/routes/index.routes');
const db = require('./src/models');

const app = express();

// Middlewares
// Configuração de CORS
// PARA LIBERAR PARA QUALQUER ENDEREÇO:
app.use(cors()); // Isso permite TODAS as origens ('*') por padrão.
                 // ATENÇÃO: Para produção, é mais seguro especificar as origens permitidas.

// Configuração anterior (com origem específica, mantida comentada para referência):
/*
app.use(cors({
  origin: 'http://localhost:5175', // Permite requisições desta origem específica
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'], // Métodos permitidos
  allowedHeaders: ['Content-Type', 'Authorization'], // Cabeçalhos permitidos
  credentials: true // Se você for usar cookies ou sessões baseadas em cabeçalhos de autorização
}));
*/

// Aumenta o limite do payload para JSON e URL-encoded para 50MB
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve arquivos estáticos da pasta 'public'
// Ex: http://localhost:3001/uploads/images/nome.jpg
app.use(express.static(path.join(__dirname, 'public')));

// Rotas
app.use('/', allRoutes); // Monta todas as rotas da API

// Rota de Teste
app.get('/', (req, res) => {
  res.send('Servidor do Blog Famosos na Mídia está no ar!');
});

// Middleware de Tratamento de Erros Genérico
app.use((err, req, res, next) => {
  console.error("ERRO NÃO TRATADO:", err.stack); // Logue o stack trace completo para depuração

  // Tratamento específico para erros do Multer
  if (err.name === 'MulterError') {
    let message = `Erro de upload: ${err.message}.`;
    if (err.code) message += ` Código: ${err.code}`;
    return res.status(400).json({ message });
  }

  // Tratamento específico para PayloadTooLargeError do body-parser
  if (err.type === 'entity.too.large') { // O erro 'PayloadTooLargeError' tem essa propriedade 'type'
    return res.status(413).json({ // 413 Payload Too Large é o status HTTP correto
        message: 'O payload da requisição é muito grande.',
        errorType: err.type,
        limit: err.limit, // Informa o limite que foi excedido
        length: err.length // Informa o tamanho do payload recebido
    });
  }

  // Outros erros
  res.status(500).json({ message: 'Ocorreu um erro inesperado no servidor.' });
});

// Função para sincronizar o banco de dados
const syncDatabase = async () => {
  try {
    // Sincroniza todos os modelos. Use { alter: true } em dev para evitar perda de dados
    // ou { force: true } em dev se quiser dropar e recriar tabelas a cada execução.
    // NUNCA use { force: true } em produção!
await db.sequelize.sync({ force: true });
    console.log('Banco de dados sincronizado com sucesso.');
  } catch (error) {
    console.error('Erro ao sincronizar o banco de dados:', error);
    // Em um ambiente de produção, você pode querer parar o servidor se o DB não sincronizar
    // process.exit(1);
  }
};

// Função para iniciar o servidor
const startServer = async () => {
    // Sincroniza o banco de dados ANTES de iniciar o servidor
    await syncDatabase();

    const PORT = configModule.port || 3001;

    app.listen(PORT, () => {
      console.log(`Servidor rodando na porta ${PORT} no ambiente ${configModule.nodeEnv}`);

      // Verifica se o JWT_SECRET está definido
      if (!configModule.jwtSecret) {
          console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
          console.error("ERRO DE CONFIGURAÇÃO: JWT_SECRET não está definido!");
          console.error("Por favor, defina a variável JWT_SECRET no seu arquivo .env");
          console.error("!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
          // Em produção, você pode querer parar o processo aqui: process.exit(1);
      
        schedulePostPublisher();

        }
    });
};

// Inicia a aplicação (sincroniza DB e depois inicia o servidor)
startServer();

// Exporta a instância do app (útil para testes, por exemplo)
module.exports = app;