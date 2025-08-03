'use strict';
const { Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const validator = require('validator'); // Importa a biblioteca validator

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    /**
     * Compara a senha enviada com o hash armazenado no banco de dados.
     * @param {string} password A senha em texto plano.
     * @returns {boolean} True se a senha for válida.
     */
    isValidPassword(password) {
      return bcrypt.compareSync(password, this.passwordHash);
    }

    /**
     * Helper method for defining associations.
     * This method is not a part of Sequelize lifecycle.
     * The `models/index` file will call this method automatically.
     */
    static associate(models) {
      // Um Usuário (como autor) pode ter muitos Posts
      User.hasMany(models.Post, {
        foreignKey: 'authorId',
        as: 'posts',
        onDelete: 'SET NULL', // Se o autor for deletado, os posts não terão autor
        onUpdate: 'CASCADE'
      });

      // Um Usuário pode fazer muitos Comentários
      User.hasMany(models.Comment, {
        foreignKey: 'userId',
        as: 'comments',
        onDelete: 'SET NULL', // Se o usuário for deletado, seus comentários se tornam de "convidado"
        onUpdate: 'CASCADE'
      });
    }
  }

  User.init({
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        notEmpty: {
          msg: 'O campo nome não pode estar vazio.'
        }
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: {
        msg: 'Este email já está cadastrado.'
      },
      validate: {
        isEmail: {
          msg: 'Forneça um endereço de email válido.'
        }
      }
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    // Este é um campo virtual, ele não existe no banco de dados.
    // Usamos ele para receber a senha em texto plano e automaticamente fazer o hash.
    password: {
        type: DataTypes.VIRTUAL,
        set(value) {
            if (value && value.length >= 6) { // Exemplo de validação mínima de senha
                const salt = bcrypt.genSaltSync(10);
                // Armazena o hash no campo real 'passwordHash'
                this.setDataValue('passwordHash', bcrypt.hashSync(value, salt));
            }
        }
    },
    role: {
      type: DataTypes.ENUM('admin', 'author', 'user'),
      allowNull: false,
      defaultValue: 'user'
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    profileImageUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        // --- INÍCIO DA VALIDAÇÃO CORRIGIDA ---
        isUrlOrNull(value) {
          // Se o valor for nulo ou vazio, a validação passa.
          if (value === null || value === undefined || value === '') {
              return;
          }
          // Apenas se um valor for fornecido, verificamos se é uma URL.
          if (!validator.isURL(value)) {
              throw new Error('O valor de profileImageUrl não é uma URL válida.');
          }
        }
        // --- FIM DA VALIDAÇÃO CORRIGIDA ---
      }
    },
    profileUrl: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        // --- INÍCIO DA VALIDAÇÃO CORRIGIDA ---
        isUrlOrNull(value) {
          if (value === null || value === undefined || value === '') {
              return;
          }
          if (!validator.isURL(value)) {
              throw new Error('O valor de profileUrl não é uma URL válida.');
          }
        }
        // --- FIM DA VALIDAÇÃO CORRIGIDA ---
      }
    }
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'Users',
    timestamps: true,
    scopes: {
      // Por padrão, NUNCA inclua o hash da senha
      defaultScope: {
        attributes: { exclude: ['passwordHash'] },
      },
      // Scope para buscar o usuário COM o hash (necessário para login)
      withPassword: {
        attributes: {},
      },
    },
    hooks: {
      // Garante que o email seja sempre minúsculo antes de qualquer operação
      beforeValidate: (user, options) => {
        if (user.email) {
          user.email = user.email.toLowerCase();
        }
      },
    }
  });

  return User;
};