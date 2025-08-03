// src/services/auth.service.js (no backend)
const { User } = require('../models');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config'); // <<< VERIFIQUE ESTA LINHA

const registerUser = async (userData) => {
  try {
    const { name, email, password, role } = userData;

    // A verificação de email existente já está correta.
    const existingUser = await User.findOne({ where: { email: email.toLowerCase() } });
    if (existingUser) {
      throw new Error('Este email já está cadastrado.');
    }

    // CORREÇÃO AQUI:
    // Mude de 'passwordHash: password' para 'password: password'
    // O hook do modelo User se encarregará de fazer o hash e salvar em 'passwordHash'
    const newUser = await User.create({
      name,
      email,
      password: password, // <--- LINHA CORRIGIDA
      role: role || 'user',
    });

    const userResponse = newUser.toJSON();
    delete userResponse.passwordHash;
    return userResponse;
  } catch (error) {
    console.error('Erro no serviço de registro:', error.message);
    throw error;
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