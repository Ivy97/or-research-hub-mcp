const fs = require('fs');
const path = require('path');
const vm = require('vm');

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

(() => {
  const root = process.cwd();
  const serverPath = path.join(root, 'server.cjs');
  const subsPath = path.join(root, 'subscriptions.json');
  const serverText = fs.readFileSync(serverPath, 'utf8');
  const subs = JSON.parse(fs.readFileSync(subsPath, 'utf8'));

  assert(Array.isArray(subs.subscriptions), 'subscriptions.json must contain subscriptions array');
  assert(subs.subscriptions.length > 0, 'subscriptions.json must not be empty');

  for (const item of subs.subscriptions) {
    assert(item.id && item.name && item.url, `invalid subscription item: ${JSON.stringify(item)}`);
  }

  new vm.Script(serverText, { filename: 'server.cjs' });

  const requiredTools = [
    'list_subscriptions',
    'subscribe_journal',
    'unsubscribe_journal',
    'refresh_subscriptions',
    'query_subscribed_papers',
    'intelligence_search',
    'daily_push',
    'save_brief_markdown',
    'list_paper_index'
  ];

  for (const tool of requiredTools) {
    assert(serverText.includes(`'${tool}'`), `missing tool registration: ${tool}`);
  }

  console.log(JSON.stringify({ subscriptions: subs.subscriptions.length, requiredTools: requiredTools.length, status: 'PASS' }, null, 2));
})();
