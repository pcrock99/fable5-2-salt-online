// 用户相关控制器：后续按需求扩展。
module.exports = {
  hello(req, res) {
    res.json({ message: req.t('msg.hello') });
  }
};
