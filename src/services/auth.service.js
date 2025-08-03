// src/services/auth.service.js (no backend)
const { User } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config'); // <<< VERIFIQUE ESTA LINHA


const registerUser = async (userData) => {
  try {
    const { name, email, password, role } = userData;

    // Validação extra para garantir que os dados chegaram
    if (!name || !email || !password) {
      throw new Error("Nome, email e senha são obrigatórios.");
    }

    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      throw new Error('Este email já está cadastrado.');
    }

    // --- INÍCIO DA CORREÇÃO CRÍTICA ---

    // 1. Gerar o "sal" para o hash. Um valor de 10 é seguro e padrão.
    const salt = await bcrypt.genSalt(10);
    
    // 2. Criptografar a senha recebida usando o sal gerado.
    const hashedPassword = await bcrypt.hash(password, salt);

    // 3. Criar o novo usuário no banco de dados com a SENHA CRIPTOGRAFADA.
    const newUser = await User.create({
      name,
      email: email.toLowerCase(), // É uma boa prática salvar emails em minúsculo
      passwordHash: hashedPassword, // Agora passamos o hash para o campo correto
      role: role || 'user',
    });

    // --- FIM DA CORREÇÃO CRÍTICA ---

    const userResponse = newUser.toJSON();
    delete userResponse.passwordHash; // Remove o hash da resposta por segurança
    return userResponse;
  } catch (error) {
    // Log do erro completo para ajudar em futuras depurações
    console.error('Erro detalhado no serviço de registro:', error);
    throw new Error(error.message || 'Ocorreu um erro interno ao registrar o usuário.');
  }
};
const loginUser = async (email, password) => {
  try {
    if (!config.jwtSecret) { // Adiciona uma verificação explícita
        console.error("ERRO FATAL: JWT_SECRET não está definido nas configurações!");
        throw new Error("Erro de configuração do servidor (JWT).");
    }

    const user = await User.scope('withPassword').findOne({ where: { email: email.toLowerCase() } });

    if (!user) {
      throw new Error('Email ou senha inválidos.');
    }

    const isMatch = await user.isValidPassword(password);
    if (!isMatch) {
      throw new Error('Email ou senha inválidos.');
    }

    const payload = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
    };

    const token = jwt.sign(
      payload,
      config.jwtSecret, // <<< Assegure que config.jwtSecret tem valor
      { expiresIn: config.jwtExpiresIn }
    );

    const userResponse = user.toJSON();
    delete userResponse.passwordHash;

    return { user: userResponse, token };
  } catch (error) {
    // Não logar a senha ou detalhes sensíveis aqui em produção
    console.error('Erro no serviço de login:', error.message); 
    // Se for um erro de configuração, não exponha detalhes ao cliente
    if (error.message.includes("Erro de configuração do servidor")) {
        throw new Error("Ocorreu um problema no servidor. Tente novamente mais tarde.");
    }
    throw error; // Re-lança o erro para ser tratado pelo controller
  }
};

module.exports = {
  registerUser,
  loginUser,
};