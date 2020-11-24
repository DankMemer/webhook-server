const core = require('./core');
const lighttp = require('lighttp');
const { logErrors } = require('../../util');

module.exports = (app, config) =>
  app.post('/paypal', async (req, res) => {
    let result;
    try {
      result = await core(req, res);
    } catch (e) {
      result = {
        didAddBoxes: false,
        resend: true,
        data: JSON.parse(req.body),
        webhook: {
          title: 'runtime err',
          color: 0xFF0000,
          description: `\`\`\`\n${e.stack}\n\`\`\``
        }
      };
    }
    res.status(
      result.resend ? 500 : 200
    ).send();

    result.webhook.color = result.didAddBoxes ? 0x6CF59E : 0xCA2D36;

    lighttp.post(`https://discord.com/api/v7/webhooks/${config.donor_webhookID}/${config.donor_webhook_token}`)
      .attach('payload_json', {
        content: '='.repeat(40),
        embeds: [ result.webhook, {
          title: 'Metadata',
          color: 0x3b7bbf,
          description: `\`\`\`json\n${JSON.stringify({
            didAddBoxes: result.didAddBoxes,
            resend: result.resend
          }, '', '  ')}\n\`\`\``
        } ]
      }, undefined, 'application/json')
      .attach('file', result.data, 'ass.json', 'application/json')
      .header('content-type', 'multipart/form-data')
      .catch(logErrors);
  });
