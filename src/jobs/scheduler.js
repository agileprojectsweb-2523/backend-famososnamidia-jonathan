const cron = require('node-cron');
const postService = require('../services/post.service');

/**
 * Agenda uma tarefa para ser executada a cada minuto.
 * A string '* * * * *' é a sintaxe do cron para "a cada minuto".
 */
const schedulePostPublisher = () => {
    console.log('[Scheduler] Agendador de publicação de posts iniciado. Verificando a cada minuto.');
    
    cron.schedule('* * * * *', async () => {
        console.log('[Scheduler] Executando verificação de posts agendados...');
        try {
            await postService.publishScheduledPosts();
        } catch (error) {
            // O erro já é logado dentro da função, mas podemos adicionar um log aqui também se quisermos.
            console.error('[Scheduler] Falha na execução da tarefa de publicação agendada.');
        }
    });
};

module.exports = { schedulePostPublisher };