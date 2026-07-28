const port = process.argv[2] ?? '9333';
const prompt = process.argv[3] ?? '请只回复：连接测试通过';
const expected = process.argv[4] ?? '连接测试通过';
const autoApprove = process.argv[5] === 'approve';
const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then(response => response.json());
const page = pages.find(candidate => candidate.type === 'page');

if (!page?.webSocketDebuggerUrl) {
  throw new Error(`调试端口 ${port} 没有可用的 Electron 页面`);
}

const socket = new WebSocket(page.webSocketDebuggerUrl);
const pending = new Map();
let requestId = 0;

const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++requestId;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params }));
});

socket.addEventListener('message', event => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

const waitForComposer = `
  new Promise(resolve => {
    const deadline = Date.now() + 15000;
    const check = () => {
      if (document.querySelector('textarea') && document.querySelector('.send-button')) {
        resolve(true);
      } else if (Date.now() >= deadline) {
        resolve(false);
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  })
`;
const composer = await call('Runtime.evaluate', {
  expression: waitForComposer,
  returnByValue: true,
  awaitPromise: true,
});
if (!composer.result.value) {
  const diagnostic = await call('Runtime.evaluate', {
    expression: `JSON.stringify({
      readyState: document.readyState,
      title: document.title,
      text: document.body?.innerText,
      html: document.body?.innerHTML?.slice(0, 500)
    })`,
    returnByValue: true,
  });
  throw new Error(`composer not found: ${diagnostic.result.value}`);
}

if (prompt === '--provider-menu' || prompt === '--company-settings') {
  const menuExists = await call('Runtime.evaluate', {
    expression: `Boolean(document.querySelector('.provider-menu'))`,
    returnByValue: true,
  });
  if (!menuExists.result.value) {
    await call('Runtime.evaluate', {
      expression: `document.querySelector('.runner-select')?.click()`,
      returnByValue: true,
    });
  }
  await new Promise(resolve => setTimeout(resolve, 250));
  if (prompt === '--company-settings') {
    await call('Runtime.evaluate', {
      expression: `document.querySelectorAll('.provider-menu > button')[1]?.click()`,
      returnByValue: true,
    });
    await new Promise(resolve => setTimeout(resolve, 250));
    const settings = await call('Runtime.evaluate', {
      expression: `document.querySelector('.settings-content')?.innerText ?? ''`,
      returnByValue: true,
    });
    console.log(settings.result.value);
    socket.close();
    process.exit(settings.result.value.includes('企业 API Key') ? 0 : 1);
  }
  const menu = await call('Runtime.evaluate', {
    expression: `document.querySelector('.provider-menu')?.innerText ?? ''`,
    returnByValue: true,
  });
  console.log(menu.result.value);
  socket.close();
  process.exit(menu.result.value.includes('企业 API Key') ? 0 : 1);
}

const expression = `
  (() => {
    const textarea = document.querySelector('textarea');
    const send = document.querySelector('.send-button');
    if (!textarea || !send) return { submitted: false, reason: 'composer not found' };
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    setter.call(textarea, ${JSON.stringify(prompt)});
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    setTimeout(() => send.click(), 50);
    return { submitted: true };
  })()
`;
const submission = await call('Runtime.evaluate', {
  expression,
  returnByValue: true,
  awaitPromise: true,
});

if (!submission.result.value?.submitted) {
  throw new Error(submission.result.value?.reason ?? '无法提交测试消息');
}

const deadline = Date.now() + 120_000;
let bodyText = '';
let assistantText = '';
let approvalSeen = false;
while (Date.now() < deadline) {
  await new Promise(resolve => setTimeout(resolve, 1_000));
  const result = await call('Runtime.evaluate', {
    expression: `JSON.stringify({
      body: document.body.innerText,
      assistant: Array.from(document.querySelectorAll('.conversation-message.assistant'))
        .map(element => element.innerText)
        .join('\\n'),
      approval: Boolean(document.querySelector('.approval-actions .approve'))
    })`,
    returnByValue: true,
  });
  const snapshot = JSON.parse(result.result.value ?? '{}');
  bodyText = snapshot.body ?? '';
  assistantText = snapshot.assistant ?? '';
  if (autoApprove && snapshot.approval) {
    approvalSeen = true;
    await call('Runtime.evaluate', {
      expression: `document.querySelector('.approval-actions .approve')?.click()`,
      returnByValue: true,
    });
  }
  if (assistantText.includes(expected)) break;
  if (bodyText.includes('执行失败')) break;
}

socket.close();
const lines = bodyText.split('\n').filter(Boolean);
console.log(lines.slice(-30).join('\n'));
if (autoApprove) console.log(`approval_seen=${approvalSeen}`);

if (
  !assistantText.includes(expected)
  || bodyText.includes('执行失败')
  || (autoApprove && !approvalSeen)
) {
  process.exitCode = 1;
}
