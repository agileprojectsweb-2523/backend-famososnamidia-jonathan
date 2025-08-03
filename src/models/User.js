'use strict';
const { Model } = require('sequelize');
const bcrypt = require('bcryptjs');
const validator = require('validator');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    async isValidPassword(password) {
      return bcrypt.compare(password, this.passwordHash);
    }
    static associate(models) {
      User.hasMany(models.Post, { foreignKey: 'authorId', as: 'posts', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
      User.hasMany(models.Comment, { foreignKey: 'userId', as: 'comments', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
    }
  }
  User.init({
    // ... (COLE TODO O CONTEÚDO DO SEU User.init AQUI, SEM MUDANÇAS)
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false, validate: { notEmpty: { msg: 'O nome não pode estar vazio.' }, len: { args: [3, 255], msg: 'O nome deve ter entre 3 e 255 caracteres.' } } },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: { msg: 'Forneça um email válido.' }, notEmpty: { msg: 'O email não pode estar vazio.' } } },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM('admin', 'author', 'user'), defaultValue: 'user', allowNull: false },
    profileImageUrl: { type: DataTypes.STRING, allowNull: true, validate: { isUrlOrNull(value) { if (value && value !== '' && !validator.isURL(value)) throw new Error('Forneça uma URL de imagem válida ou deixe o campo vazio.'); } }, comment: 'URL da foto de perfil do usuário' },
    profileUrl: { type: DataTypes.STRING, allowNull: true, validate: { isUrlOrNull(value) { if (value && value !== '' && !validator.isURL(value)) throw new Error('Forneça uma URL válida ou deixe o campo vazio.'); } }, comment: 'URL do perfil/site pessoal do usuário' },
    bio: { type: DataTypes.TEXT, allowNull: true, validate: { len: { args: [0, 500], msg: 'A biografia deve ter no máximo 500 caracteres.' } }, comment: 'Biografia curta do usuário' }
  }, {
    sequelize,
    modelName: 'User',
    tableName: 'users',
    // ... (COLE O RESTO DAS OPÇÕES DO SEU MODELO AQUI: scopes, hooks, etc)
    timestamps: true,
    comment: 'Representa os usuários do sistema (administradores, autores, leitores)',
    defaultScope: { attributes: { exclude: ['passwordHash'] } },
    scopes: { withPassword: { attributes: { include: ['passwordHash'] } } },
    hooks: {
      beforeCreate: async (user) => { if (user.email) user.email = user.email.toLowerCase(); if (user.passwordHash && user.passwordHash.length < 60) user.passwordHash = await bcrypt.hash(user.passwordHash, 10); },
      beforeUpdate: async (user) => { if (user.changed('email') && user.email) user.email = user.email.toLowerCase(); if (user.changed('passwordHash') && user.passwordHash && user.passwordHash.length < 60) user.passwordHash = await bcrypt.hash(user.passwordHash, 10); }
    },
    indexes: [{ unique: true, fields: ['email'] }]
  });
  return User;
};