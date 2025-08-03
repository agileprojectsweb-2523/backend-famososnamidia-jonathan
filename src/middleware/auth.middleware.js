// src/auth/auth.middleware.js (no backend)
const jwt = require('jsonwebtoken');
const config = require('../config/config'); // <<< VERIFIQUE ESTA LINHA
const { User } = require('../models');

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) {
    return res.status(401).json({ message: 'Acesso não autorizado. Token não fornecido.' });
  }

  if (!config.jwtSecret) { // Adiciona uma verificação explícita
    console.error("ERRO FATAL NO MIDDLEWARE: JWT_SECRET não está definido nas configurações!");
    return res.status(500).json({ message: "Erro de configuração do servidor (JWT)." });
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret); // <<< Assegure que config.jwtSecret tem valor
    
    const user = await User.findByPk(decoded.id); // Busca o usuário para garantir que ainda existe
    if (!user) {
        return res.status(403).json({ message: 'Token inválido ou usuário não existe mais.' });
    }
    // Adiciona o objeto usuário (sem senha por default scope) à requisição
    // O defaultScope do User model já exclui passwordHash
    req.user = user; 
    next();
  } catch (err) {
    console.error("Erro na autenticação do token:", err.name, err.message);
    if (err.name === 'TokenExpiredError') {
      return res.status(403).json({ message: 'Token expirado. Faça login novamente.' });
    }
    // Para outros erros de JWT (JsonWebTokenError), como token malformado ou assinatura inválida
    if (err.name === 'JsonWebTokenError') {
      return res.status(403).json({ message: 'Token inválido ou corrompido.' });
    }
    // Erro genérico se não for um erro JWT conhecido
    return res.status(403).json({ message: 'Falha na autenticação do token.' });
  }
};

const authorizeRole = (roles) => {
  return (req, res, next) => {
    if (!req.user || (Array.isArray(roles) ? !roles.includes(req.user.role) : req.user.role !== roles)) {
      return res.status(403).json({ message: 'Acesso negado. Você não tem permissão para este recurso.' });
    }
    next();
  };
};


const softAuthenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (token == null) {
    // Nenhum token, continua como guest, req.user não será definido
    return next(); 
  }

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const user = await User.findByPk(decoded.id);
    if (user) {
      req.user = user; // Adiciona usuário à requisição se o token for válido
    }
    // Se o usuário não for encontrado ou o token for inválido mas não expirado (ex: user deletado),
    // req.user não será definido, e a requisição prossegue como guest.
    // Se o token estiver expirado ou for malformado, jwt.verify lançará um erro.
  } catch (err) {
    // Se houver erro na verificação (ex: expirado, malformado), não define req.user e continua
    // Poderia logar o erro, mas não bloquear a requisição para guests.
    console.warn("Soft Authenticate: Erro ao verificar token (pode ser expirado ou inválido, continuando como guest):", err.name);
  }
  next();
};



module.exports = {
    authenticateToken,
    authorizeRole,
    softAuthenticateToken
  };