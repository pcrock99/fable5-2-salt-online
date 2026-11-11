const startedAt = Date.now();
const {
  getLeaderboard,
  getOnlinePlayers,
  RESPAWN_MS
} = require('../realtime/multiplayer');
const contentFilter = require('../services/contentFilter');

module.exports = {
  health(req, res) {
    res.json({
      ok: true,
      message: req.t('api.health'),
      lang: req.lang,
      uptimeSeconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000))
    });
  },

  meta(req, res) {
    res.json({
      ok: true,
      lang: req.lang,
      title: req.t('game.title'),
      tagline: req.t('game.tagline'),
      version: '1.11.0',
      engine: 'WebGL / Three.js (bundled)',
      mode: 'free-for-all',
      respawnSeconds: Math.round(RESPAWN_MS / 1000),
      online: getOnlinePlayers().length,
      websocket: '/ws',
      moderation: contentFilter.descriptor(),
      comms: {
        voice: 'server-pcm-relay',
        sampleRate: 16000,
        frameMs: 20,
        globalAudience: true,
        listenerMicRequired: false,
        bigText: true,
        chatMaxLength: 80,
        chatCooldownMs: 1200
      },
      controls: [
        { keys: 'WASD', label: req.t('controls.move') },
        { keys: 'Mouse', label: req.t('controls.look') },
        { keys: 'LMB', label: req.t('controls.fire') },
        { keys: 'RMB', label: req.t('controls.aim') },
        { keys: 'R', label: req.t('controls.reload') },
        { keys: 'E', label: req.t('controls.interact') },
        { keys: 'Space', label: req.t('controls.jump') },
        { keys: 'Shift', label: req.t('controls.sprint') },
        { keys: 'C / Ctrl', label: req.t('controls.crouch') },
        { keys: 'F', label: req.t('controls.melee') },
        { keys: 'M', label: req.t('controls.mic') },
        { keys: 'T', label: req.t('controls.bigText') },
        { keys: 'Tab', label: req.t('controls.roster') },
        { keys: 'Esc / P', label: req.t('controls.pause') }
      ]
    });
  },

  leaderboard(req, res) {
    const online = getOnlinePlayers();
    res.json({
      ok: true,
      lang: req.lang,
      online: online.length,
      players: online,
      respawnSeconds: Math.round(RESPAWN_MS / 1000),
      leaderboard: getLeaderboard(req.query && req.query.limit)
    });
  }
};
