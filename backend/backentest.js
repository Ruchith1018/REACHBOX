// backend/test/slackTest.js
const axios = require('axios');
require('dotenv').config();
(async () => {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return console.error('Set SLACK_WEBHOOK_URL in backend/.env');
  const resp = await axios.post(url, { text: 'Test notification from Outbox Onebox (node)'});
  console.log('Slack status', resp.status);
})();
