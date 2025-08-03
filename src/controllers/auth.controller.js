// src/auth/auth.controller.js
const authService = require('../services/auth.service');
// (Opcional) const userService = require('../services/user.service'); // Se getMe ficar aqui

const register = async (req, res) => {
  try {
    // <<< INÍCIO DA VALIDAÇÃO ADICIONADA
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ 
        message: 'Campos obrigatórios ausentes. É necessário enviar name, email e password.' 
      });
    }
    // FIM DA VALIDAÇÃO ADICIONADA >>>

    // O req.body inteiro é passado para o serviço, que saberá lidar com o campo 'role'
    const user = await authService.registerUser(req.body); 
    
    res.status(201).json({ message: 'Usuário registrado com sucesso! Faça login para continuar.' });
  } catch (error) {
    // Retorna um erro 400 (Bad Request) para erros de validação ou de email já existente
    res.status(400).json({ message: error.message || 'Erro ao registrar usuário.' });
  }
};

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