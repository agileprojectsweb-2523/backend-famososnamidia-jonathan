'use strict';
const { Model, Op } = require('sequelize');
const validator = require('validator');

module.exports = (sequelize, DataTypes) => {
  class Comment extends Model {
    static associate(models) {
      Comment.belongsTo(models.Post, { foreignKey: { name: 'postId', allowNull: false }, as: 'post', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
      Comment.belongsTo(models.User, { foreignKey: { name: 'userId', allowNull: true }, as: 'user', onDelete: 'SET NULL', onUpdate: 'CASCADE' });
    }
  }
  Comment.init({
    // ... (COLE TODO O CONTEÚDO DO SEU Comment.init AQUI)
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    content: { type: DataTypes.TEXT, allowNull: false, validate: { notEmpty: { msg: 'O conteúdo do comentário não pode estar vazio.' }, len: { args: [1, 2000], msg: 'O comentário deve ter entre 1 e 2000 caracteres.'} } },
    guestName: { type: DataTypes.STRING, allowNull: true },
    guestEmail: { type: DataTypes.STRING, allowNull: true, validate: { isEmailOrNull(value) { if (value && value !== '' && !validator.isEmail(value)) throw new Error('Forneça um email válido ou deixe o campo vazio.'); } } }
  }, {
    sequelize,
    modelName: 'Comment',
    tableName: 'comments',
    // ... (COLE O RESTO DAS OPÇÕES DO SEU MODELO AQUI)
    timestamps: true,
    comment: 'Representa os comentários nos posts do blog',
    hooks: {
      beforeCreate: (comment) => { if (comment.guestEmail) comment.guestEmail = comment.guestEmail.toLowerCase(); },
      beforeUpdate: (comment) => { if (comment.changed('guestEmail') && comment.guestEmail) comment.guestEmail = comment.guestEmail.toLowerCase(); }
    },
    indexes: [{ fields: ['postId'] }, { fields: ['userId'], where: { userId: { [Op.ne]: null } } }]
  });
  return Comment;
};