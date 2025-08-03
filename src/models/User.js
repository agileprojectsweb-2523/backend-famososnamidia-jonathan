// src/models/User.js
const { DataTypes, Op } = require('sequelize');
const sequelize = require('../config/database'); // Ajuste o caminho se necessário
const bcrypt = require('bcryptjs');
const validator = require('validator'); // Usando o pacote 'validator'

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      notEmpty: { msg: 'O nome não pode estar vazio.' },
      len: { args: [3, 255], msg: 'O nome deve ter entre 3 e 255 caracteres.' }
    }
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
      isEmail: { msg: 'Forneça um email válido.' },
      notEmpty: { msg: 'O email não pode estar vazio.' }
    }
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false, // Senha obrigatória para usuários do sistema
  },
  role: {
    type: DataTypes.ENUM('admin', 'author', 'user'), // 'user' para leitores que podem comentar logados
    defaultValue: 'user',
    allowNull: false,
  },
  profileImageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isUrlOrNull(value) {
        if (value !== null && value !== '' && !validator.isURL(value)) {
          throw new Error('Forneça uma URL de imagem válida ou deixe o campo vazio.');
        }
      }
    },
    comment: 'URL da foto de perfil do usuário'
  },
  profileUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isUrlOrNull(value) {
        if (value !== null && value !== '' && !validator.isURL(value)) {
          throw new Error('Forneça uma URL válida ou deixe o campo vazio.');
        }
      }
    },
    comment: 'URL do perfil/site pessoal do usuário'
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: { args: [0, 500], msg: 'A biografia deve ter no máximo 500 caracteres.' }
    },
    comment: 'Biografia curta do usuário'
  }
}, {
  tableName: 'users',
  timestamps: true,
  comment: 'Representa os usuários do sistema (administradores, autores, leitores)',
  defaultScope: {
    attributes: { exclude: ['passwordHash'] }, // Não retorna o hash da senha por padrão
  },
  scopes: {
    withPassword: {
      attributes: { include: ['passwordHash'] },
    }
  },
  hooks: {
    beforeCreate: async (user) => {
      if (user.email) {
        user.email = user.email.toLowerCase();
      }
      if (user.passwordHash) {
        // Garante que não estamos re-hasheando um hash (segurança extra)
        if (user.passwordHash.length < 60) { // Hashes bcrypt têm 60 caracteres
            user.passwordHash = await bcrypt.hash(user.passwordHash, 10);
        }
      }
    },
    beforeUpdate: async (user) => {
      if (user.changed('email') && user.email) {
        user.email = user.email.toLowerCase();
      }
      if (user.changed('passwordHash') && user.passwordHash) {
         // Garante que não estamos re-hasheando um hash
        if (user.passwordHash.length < 60) {
            user.passwordHash = await bcrypt.hash(user.passwordHash, 10);
        }
      }
    }
  },
  indexes: [
    { unique: true, fields: ['email'] }
  ]
});

// Método de instância para verificar a senha
User.prototype.isValidPassword = async function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

// Associações
User.associate = (models) => {
  User.hasMany(models.Post, {
    foreignKey: 'authorId', // Chave estrangeira em Post
    as: 'posts',
    onDelete: 'SET NULL', // Se um autor for deletado, os posts ficam sem autor ou são atribuídos a um "usuário sistema"
    onUpdate: 'CASCADE',
  });
  User.hasMany(models.Comment, {
    foreignKey: 'userId', // Chave estrangeira em Comment
    as: 'comments',
    onDelete: 'CASCADE', // Se um usuário for deletado, seus comentários também são
    onUpdate: 'CASCADE',
  });
};

module.exports = User;