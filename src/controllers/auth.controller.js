// src/auth/auth.controller.js
const authService = require('../services/auth.service');
// (Opcional) const userService = require('../services/user.service'); // Se getMe ficar aqui

const register = async (req, res) => {
  // ADICIONE ESTAS 3 LINHAS PARA DEPURAR
  console.log('--- NOVA REQUISIÇÃO DE REGISTRO ---');
  console.log('CABEÇALHOS RECEBIDOS:', JSON.stringify(req.headers, null, 2));
  console.log('CORPO (BODY) RECEBIDO:', JSON.stringify(req.body, null, 2));

  try {
    const user = await authService.registerUser(req.body);
    res.status(201).json({ message: 'Usuário registrado com sucesso! Faça login para continuar.' });
  } catch (error) {
    res.status(400).json({ message: error.message || 'Erro ao registrar usuário.' });
  }
}

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ message: 'Email e senha são obrigatórios.' });
    }
    const data = await authService.loginUser(email, password);
    res.status(200).json(data);
  } catch (error) {
    // Usar 401 para falha de autenticação é mais apropriado
    res.status(401).json({ message: error.message || 'Falha no login. Verifique suas credenciais.' });
  }
};

const getMe = async (req, res) => {
    // req.user é populado pelo middleware authenticateToken
    if (req.user) {
        const userResponse = req.user.toJSON(); // Garante que o defaultScope seja aplicado
        // delete userResponse.passwordHash; // Já é feito pelo defaultScope
        res.status(200).json(userResponse);
    } else {
        // Este caso não deveria ocorrer se authenticateToken estiver funcionando
        res.status(401).json({ message: "Não autenticado." });
    }
};

module.exports = {
  register,
  login,
  getMe,
};