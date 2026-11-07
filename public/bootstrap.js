import {t,getLanguage,applyLanguage} from './i18n.js';
const store='fdudash.device.v1',base='http://127.0.0.1:5173';
const words={'连接你的设备':['Connect your device','Coniunge instrumentum tuum'],'校园密码和数据保存在你的设备，校园请求使用你的网络。':['Campus credentials and data stay on your device; requests use your network.','Tesserae et data in tuo instrumento manent; rete tuum adhibetur.'],'下载 Windows 连接器':['Download Windows connector','Depone connexorem Windows'],'解压后运行 Start.cmd，获取一次性配对码。':['Extract and run Start.cmd to get a one-time pairing code.','Extrahe et Start.cmd exsequere ad codicem accipiendum.'],'配对码':['Pairing code','Codex coniunctionis'],'连接':['Connect','Coniunge'],'无法连接，请启动本机连接器、允许浏览器访问本机网络，并检查配对码。':['Could not connect. Start the local connector, allow local network access, and check the pairing code.','Coniunctio defecit. Connexorem localem incipe et codicem verifica.'],'在当前设备运行连接器后，即可读取个人校园信息。':['Run the connector on this device to access personal campus information.','Connexore in hoc instrumento incepto, data universitatis legere potes.'],'正在连接…':['Connecting…','Coniungitur…']};
const tr=s=>getLanguage()==='en'?words[s]?.[0]||t(s):getLanguage()==='la'?words[s]?.[1]||t(s):t(s);
const preference = 'fdudash.use-device';
const control = document.getElementById('device-controls');
const row = document.createElement('label');
row.className = 'motion-setting';
const label = document.createElement('span');
const toggle = document.createElement('input');
toggle.type = 'checkbox';
row.append(label, toggle);
control.before(row);
const status = document.createElement('p');
row.after(status);

function labels() {
 label.textContent = t('使用本机连接器');
}
labels();
window.addEventListener('fdudash-language', labels);

function prompt() {
 const dialog = document.createElement('dialog');
 dialog.className = 'card device-connect';
 dialog.id = 'device-connect';
 const heading = document.createElement('h2');
 heading.textContent = tr('连接你的设备');
 const download = document.createElement('a');
 download.href = '/downloads/fdudash-connector-windows-x64.zip';
 download.textContent = tr('下载 Windows 连接器');
 const steps = document.createElement('p');
 steps.textContent = tr('解压后运行 Start.cmd，获取一次性配对码。');
 const form = document.createElement('form');
 const codeLabel = document.createElement('label');
 codeLabel.textContent = tr('配对码');
 const input = document.createElement('input');
 input.inputMode = 'numeric';
 input.pattern = '[0-9]{8}';
 input.required = true;
 codeLabel.append(input);
 const submit = document.createElement('button');
 submit.textContent = tr('连接');
 const cancel = document.createElement('button');
 cancel.type = 'button';
 cancel.textContent = t('取消');
 cancel.onclick = () => dialog.close();
 const message = document.createElement('p');
 message.role = 'status';
 form.append(codeLabel, submit, cancel);
 dialog.append(heading, download, steps, form, message);
 document.body.append(dialog);
 dialog.addEventListener('close', () => { toggle.checked = false; dialog.remove(); });
 dialog.showModal();
 form.onsubmit = async event => {
  event.preventDefault();
  submit.disabled = true;
  try {
   const response = await fetch(base + '/bridge/pair', {
    method: 'POST', credentials: 'omit', targetAddressSpace: 'loopback',
    headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code: input.value})
   });
   if (!response.ok) throw Error();
   localStorage.setItem(store, JSON.stringify(await response.json()));
   localStorage.setItem(preference, 'true');
   location.reload();
  } catch {
   message.textContent = tr('无法连接，请启动本机连接器、允许浏览器访问本机网络，并检查配对码。');
   submit.disabled = false;
  }
 };
}

async function connectSaved() {
 try {
  const device = JSON.parse(localStorage.getItem(store));
  if (!device?.token || Date.parse(device.expiresAt) <= Date.now()) return false;
  const response = await fetch(base + '/api/session', {
   headers: {'X-FDUDash-Device': device.token}, credentials: 'omit',
   targetAddressSpace: 'loopback', signal: AbortSignal.timeout(4000)
  });
  if (!response.ok) return false;
  return Object.freeze({base, token: device.token});
 } catch { return false; }
}

toggle.onchange = async () => {
 if (!toggle.checked) {
  localStorage.removeItem(preference);
  location.reload();
  return;
 }
 toggle.disabled = true;
 const connected = await connectSaved();
 toggle.disabled = false;
 if (connected) {
  localStorage.setItem(preference, 'true');
  location.reload();
 } else prompt();
};

if (localStorage.getItem(preference) === 'true') {
 globalThis.FDUDASH_DEVICE = await connectSaved();
 toggle.checked = Boolean(globalThis.FDUDASH_DEVICE);
 if (!toggle.checked) {
  localStorage.removeItem(preference);
  status.textContent = t('本机连接器不可用，当前使用服务器。');
 }
}
globalThis.FDUDASH_HOSTED = !globalThis.FDUDASH_DEVICE;
control.hidden = globalThis.FDUDASH_HOSTED;
window.addEventListener('fdudash-device-disconnected', () => {
 localStorage.removeItem(store);
 localStorage.removeItem(preference);
 location.reload();
});
applyLanguage();
await import('./app.js');
