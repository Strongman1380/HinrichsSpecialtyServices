const { onRequest } = require('firebase-functions/v2/https');
const { setGlobalOptions } = require('firebase-functions/v2');
const admin = require('firebase-admin');

admin.initializeApp();

const aiSurveyHandler = require('./handlers/ai-survey');
const createLeadHandler = require('./handlers/create-lead');
const sendCampaignHandler = require('./handlers/send-campaign');
const sendInvoiceHandler = require('./handlers/send-invoice');
const chatHandler = require('./handlers/chat');
const submitSurveyHandler = require('./handlers/submit-survey');

setGlobalOptions({
  region: 'us-central1',
  memory: '256MiB',
  timeoutSeconds: 60,
  maxInstances: 10,
});

function run(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (err) {
      console.error('[function] Unhandled error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}

const publicOptions = {
  invoker: 'public',
};

exports.aiSurvey = onRequest(publicOptions, run(aiSurveyHandler));
exports.createLead = onRequest(publicOptions, run(createLeadHandler));
exports.sendCampaign = onRequest(publicOptions, run(sendCampaignHandler));
exports.sendInvoice = onRequest(publicOptions, run(sendInvoiceHandler));
exports.chat = onRequest(publicOptions, run(chatHandler));
exports.submitSurvey = onRequest(publicOptions, run(submitSurveyHandler));
exports.summary = onRequest(publicOptions, run(require("./handlers/summary")));
exports.operations = onRequest(publicOptions, run(require("./handlers/operations")));
exports.finance = onRequest(publicOptions, run(require('./handlers/finance')));
