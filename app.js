(function () {
  'use strict';
  const Q = window.QUESTIONNAIRE;
  const app = document.getElementById('app');
  const titleEl = document.getElementById('title');
  const saveEl = document.getElementById('save-state');
  // Fotos em alta resolução: lado maior até 4096 px (~12 MP, cobre a foto padrão de celular sem reduzir) e JPEG qualidade 0,92.
  // 4096 px também respeita o limite de área do canvas do iPhone (~16,7 MP).
  const MAX_PHOTOS = 20, MAX_SIDE = 4096, JPEG_Q = 0.92;
  const PRIVACY_VERSION = 'lgpd-draft-1';

  // ---------- util ----------
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
  const now = () => new Date().toISOString();
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v == null) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(kid));
    return el;
  }
  let toastT;
  function toast(msg) {
    const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600);
  }
  const validEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  const fmtDate = (iso) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes()); };

  // ---------- IndexedDB ----------
  let db;
  function openDB() {
    return new Promise((res, rej) => {
      const r = indexedDB.open('fenatran-benchmark', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        d.createObjectStore('kv');
        d.createObjectStore('evals', { keyPath: 'id' });
        d.createObjectStore('photos', { keyPath: 'id' }).createIndex('evalId', 'evalId');
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }
  function run(stores, mode, fn) {
    return new Promise((res, rej) => {
      const t = db.transaction(stores, mode);
      let out;
      const rq = fn(t);
      if (rq) rq.onsuccess = () => { out = rq.result; };
      t.oncomplete = () => res(out);
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error || new Error('Falha ao gravar (espaço insuficiente?)'));
    });
  }
  const kvGet = (k) => run('kv', 'readonly', (t) => t.objectStore('kv').get(k));
  const kvSet = (k, v) => run('kv', 'readwrite', (t) => t.objectStore('kv').put(v, k));
  const evalsAll = () => run('evals', 'readonly', (t) => t.objectStore('evals').getAll());
  const evalPut = (e) => run('evals', 'readwrite', (t) => t.objectStore('evals').put(e));
  const photosAll = () => run('photos', 'readonly', (t) => t.objectStore('photos').getAll());
  const photosOf = (id) => run('photos', 'readonly', (t) => t.objectStore('photos').index('evalId').getAll(id));
  const photoPut = (p) => run('photos', 'readwrite', (t) => t.objectStore('photos').put(p));
  const photoDel = (id) => run('photos', 'readwrite', (t) => t.objectStore('photos').delete(id));
  async function evalDelete(id) {
    const ps = await photosOf(id);
    await run(['evals', 'photos'], 'readwrite', (t) => { t.objectStore('evals').delete(id); ps.forEach((p) => t.objectStore('photos').delete(p.id)); });
  }
  const clearAll = () => run(['kv', 'evals', 'photos'], 'readwrite', (t) => { ['kv', 'evals', 'photos'].forEach((s) => t.objectStore(s).clear()); });

  // ---------- estado ----------
  let profile = null;

  // ---------- tela: perfil ----------
  function screenProfile(firstTime) {
    titleEl.textContent = firstTime ? 'Bem-vindo' : 'Meu perfil';
    saveEl.textContent = '';
    const p = profile || {};
    const f = {};
    const field = (label, el, hint) => h('div', {}, h('label', {}, label), el, hint ? h('div', { class: 'muted' }, hint) : null);
    f.name = h('input', { type: 'text', autocomplete: 'name', value: p.name || '' });
    f.email = h('input', { type: 'email', autocomplete: 'email', inputmode: 'email', value: p.email || '' });
    f.role = h('select', {}, h('option', { value: '' }, 'Selecione…'), Q.profile.roles.map((a) => h('option', { value: a, selected: p.role === a }, a)));
    f.department = h('input', { type: 'text', maxlength: 80, value: p.department || '', placeholder: 'Escreva a sua área', autocomplete: 'off' });
    f.consent = h('input', { type: 'checkbox', checked: !!(p.consent && p.consent.accepted) });
    const err = h('div', { class: 'err' });

    const form = h('div', {},
      firstTime ? h('div', { class: 'card' }, h('h1', {}, 'Benchmark de caminhões – FENATRAN'),
        h('p', {}, 'Registre o modelo avaliado, tire fotos e responda ao questionário. Funciona sem internet depois do primeiro acesso.')) : null,
      h('div', { class: 'card' }, h('h2', {}, 'Quem é você'),
        field('Nome *', f.name), field('E-mail *', f.email, 'Você informa o e-mail; o app não verifica a identidade.'),
        field('Função', f.role), field('Área', f.department)),
      h('div', { class: 'card' }, h('h2', {}, 'Privacidade (LGPD)'),
        h('p', { class: 'muted' }, 'Seus dados, respostas e fotos ficam neste aparelho até você exportá-los e enviá-los à equipe organizadora do benchmark da Volvo. Usamos só para analisar a comparação entre caminhões. Não coletamos localização. Evite fotografar rostos, crachás e placas de pessoas. Você pode apagar tudo do aparelho a qualquer momento.'),
        h('label', { class: 'check' }, f.consent, h('span', {}, 'Li e concordo com o uso dos meus dados para este benchmark. *'))),
      err,
      h('button', {
        class: 'block', onclick: async () => {
          [f.name, f.email, f.consent].forEach((x) => x.classList.remove('invalid'));
          const name = f.name.value.trim(), email = f.email.value.trim();
          if (!name) { f.name.classList.add('invalid'); err.textContent = 'Informe seu nome.'; return f.name.focus(); }
          if (!validEmail(email)) { f.email.classList.add('invalid'); err.textContent = 'Informe um e-mail válido.'; return f.email.focus(); }
          if (!f.consent.checked) { f.consent.classList.add('invalid'); err.textContent = 'É preciso concordar para continuar.'; return; }
          const wasAccepted = p.consent && p.consent.accepted;
          profile = {
            id: p.id || uid(), name, email, role: f.role.value, department: f.department.value.trim(),
            consent: wasAccepted ? p.consent : { accepted: true, version: PRIVACY_VERSION, at: now() }
          };
          try { await kvSet('profile', profile); } catch (e) { err.textContent = 'Não foi possível salvar: ' + e.message; return; }
          screenHome();
        }
      }, firstTime ? 'Começar' : 'Salvar'),
      firstTime ? null : h('button', { class: 'secondary block', onclick: screenHome }, 'Voltar')
    );
    app.replaceChildren(form);
    window.scrollTo(0, 0);
  }

  // ---------- tela: início ----------
  const answeredCount = (e) => Q.sections.filter((s) => e.answers[s.id] && (e.answers[s.id].rating != null || e.answers[s.id].na)).length;

  async function screenHome() {
    titleEl.textContent = 'Benchmark FENATRAN';
    saveEl.textContent = '';
    const evals = (await evalsAll()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const photos = await photosAll();
    const counts = {}; photos.forEach((p) => { counts[p.evalId] = (counts[p.evalId] || 0) + 1; });
    const exportBtn = (e) => e.status === 'done'
      ? h('button', { type: 'button', class: 'secondary block', onclick: () => doExport(e.id) }, 'Exportar este benchmark (ZIP)')
      : h('p', { class: 'muted' }, 'Conclua a avaliação para poder exportá-la.');
    const list = evals.length ? evals.map((e) => h('div', { class: 'eval-wrap' }, h('button', { class: 'eval', onclick: () => screenEval(e.id) },
      h('b', {}, (e.brand || '—') + ' ' + (e.model || '')),
      h('span', { class: 'badge ' + e.status }, e.status === 'done' ? 'Concluída' : 'Rascunho'),
      h('span', { class: 'badge' }, answeredCount(e) + '/' + Q.sections.length + ' respostas'),
      h('span', { class: 'badge' }, (counts[e.id] || 0) + ' fotos'),
      h('div', { class: 'muted' }, 'Atualizada em ' + fmtDate(e.updatedAt))),
      exportBtn(e))) : h('p', { class: 'muted center' }, 'Nenhuma avaliação ainda.');
    app.replaceChildren(
      h('div', { class: 'card' }, h('div', {}, h('b', {}, profile.name)), h('div', { class: 'muted' }, profile.email),
        h('button', { class: 'secondary block', onclick: () => screenProfile(false) }, 'Editar perfil')),
      h('button', { class: 'block', onclick: newEval }, '+ Nova avaliação de caminhão'),
      h('h2', { style: 'margin-top:18px' }, 'Minhas avaliações'), h('div', {}, list),
      h('div', { class: 'card' }, h('h2', {}, 'Exportar e enviar'),
        h('p', { class: 'muted' }, 'Cada avaliação concluída tem o seu botão "Exportar este benchmark". O ZIP traz a planilha, os dados e as fotos só daquele caminhão, e o nome do arquivo tem o seu nome e o caminhão avaliado. Envie um arquivo por avaliação à equipe organizadora.')),
      h('div', { class: 'card' }, h('h2', {}, 'Instalar no celular'),
        h('p', { class: 'muted' }, 'Android (Chrome): menu ⋮ → Instalar app. iPhone (Safari): botão Compartilhar → Adicionar à Tela de Início. Abra uma vez com internet antes de ir à feira.')),
      h('button', { class: 'danger block', onclick: wipe }, 'Apagar todos os dados deste aparelho'),
      h('p', { class: 'muted center', id: 'storage' }, '')
    );
    showStorage();
    window.scrollTo(0, 0);
  }

  async function showStorage() {
    try {
      const el = document.getElementById('storage');
      if (!el || !navigator.storage || !navigator.storage.estimate) return;
      const est = await navigator.storage.estimate();
      el.textContent = 'Armazenamento usado: ' + (est.usage / 1048576).toFixed(1) + ' MB. Se limpar os dados do navegador, o que não foi exportado se perde.';
    } catch (_) { /* ignora */ }
  }

  async function wipe() {
    if (!confirm('Apagar TODAS as avaliações, fotos e seu perfil deste aparelho? O que não foi exportado será perdido.')) return;
    await clearAll(); profile = null; screenProfile(true);
  }

  function newEval() {
    const e = { id: uid(), participantId: profile.id, questionnaireVersion: Q.version, brand: '', model: '', status: 'draft', createdAt: now(), updatedAt: now(), answers: {}, generalComment: '' };
    evalPut(e).then(() => screenEval(e.id)).catch((err) => toast('Erro ao criar: ' + err.message));
  }

  // ---------- imagens ----------
  async function loadBitmap(file) {
    try { return await createImageBitmap(file); } catch (_) { /* fallback abaixo */ }
    const url = URL.createObjectURL(file);
    try {
      return await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Formato de imagem não suportado')); im.src = url; });
    } finally { setTimeout(() => URL.revokeObjectURL(url), 5000); }
  }
  async function compress(file) {
    const img = await loadBitmap(file);
    const w0 = img.width || img.naturalWidth, h0 = img.height || img.naturalHeight;
    const k = Math.min(1, MAX_SIDE / Math.max(w0, h0));
    const c = document.createElement('canvas'); c.width = Math.round(w0 * k); c.height = Math.round(h0 * k);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    if (img.close) img.close();
    // Re-codificar em JPEG remove EXIF (incluindo localização).
    return new Promise((res, rej) => c.toBlob((b) => b ? res(b) : rej(new Error('Falha ao comprimir')), 'image/jpeg', JPEG_Q));
  }

  // ---------- tela: avaliação ----------
  async function screenEval(id) {
    const all = await evalsAll();
    const ev = all.find((e) => e.id === id);
    if (!ev) return screenHome();
    titleEl.textContent = 'Avaliação';
    let photos = (await photosOf(id)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const urls = new Map();
    const urlOf = (p) => { if (!urls.has(p.id)) urls.set(p.id, URL.createObjectURL(p.blob)); return urls.get(p.id); };
    const release = () => urls.forEach((u) => URL.revokeObjectURL(u));

    let timer;
    const save = (immediate) => {
      saveEl.textContent = 'Salvando…';
      clearTimeout(timer);
      const go = async () => {
        ev.updatedAt = now();
        try { await evalPut(ev); saveEl.textContent = 'Salvo ✓'; } catch (e) { saveEl.textContent = 'Erro ao salvar'; toast('Não foi possível salvar: ' + e.message); }
      };
      if (immediate) return go();
      timer = setTimeout(go, 400);
    };

    const progWrap = h('div', {}), progTxt = h('div', { class: 'muted' }), progBar = h('div', {});
    progWrap.append(h('div', { class: 'progress' }, progBar), progTxt);
    const updProg = () => { const n = answeredCount(ev); progBar.style.width = (n / Q.sections.length * 100) + '%'; progTxt.textContent = n + ' de ' + Q.sections.length + ' itens respondidos'; };

    // veículo
    const brand = h('input', { type: 'text', list: 'brands', value: ev.brand, placeholder: 'Ex.: Volvo', autocomplete: 'off' });
    const model = h('input', { type: 'text', list: 'models', value: ev.model, placeholder: 'Ex.: FH 540 6x4', autocomplete: 'off' });
    const dlBrands = h('datalist', { id: 'brands' }, Q.brands.map((b) => h('option', { value: b })));
    const dlModels = h('datalist', { id: 'models' }, Q.vehicles.map((v) => h('option', { value: v.model })));
    brand.addEventListener('input', () => { ev.brand = brand.value.trim(); brand.classList.remove('invalid'); save(); });
    model.addEventListener('input', () => { ev.model = model.value.trim(); model.classList.remove('invalid'); save(); });
    model.addEventListener('change', () => { // se escolher um modelo sugerido, preenche a marca
      const v = Q.vehicles.find((x) => x.model === model.value.trim());
      if (v && !brand.value.trim()) { brand.value = v.brand; ev.brand = v.brand; save(); }
    });

    // fotos: cada foto pertence a uma "área": FICHA (panfleto/ficha técnica/dados gerais) ou o id de um item do questionário
    const FICHA = 'ficha';
    const areaOf = (p) => p.sectionId || FICHA; // fotos antigas sem área contam como ficha
    const boxes = [];
    const savePhotoMeta = (p) => photoPut({ id: p.id, evalId: p.evalId, sectionId: p.sectionId, blob: p.blob, caption: p.caption, createdAt: p.createdAt });
    function photoBox(area, max, captionHint) {
      const grid = h('div', { class: 'photos' });
      const count = h('div', { class: 'muted' });
      const draw = () => {
        const mine = photos.filter((p) => areaOf(p) === area);
        count.textContent = mine.length + ' de ' + max + ' fotos';
        grid.replaceChildren(...mine.map((p) => h('div', { class: 'photo' },
          h('img', { src: urlOf(p), alt: p.caption || 'Foto' }),
          h('input', { type: 'text', placeholder: captionHint || 'Legenda (opcional)', value: p.caption || '', oninput: (e) => { p.caption = e.target.value; clearTimeout(p._t); p._t = setTimeout(() => savePhotoMeta(p).then(() => { saveEl.textContent = 'Salvo ✓'; }).catch((er) => toast('Erro: ' + er.message)), 400); } }),
          h('button', { onclick: async () => { if (!confirm('Remover esta foto?')) return; try { await photoDel(p.id); photos = photos.filter((x) => x !== p); URL.revokeObjectURL(urls.get(p.id)); urls.delete(p.id); draw(); } catch (er) { toast('Erro: ' + er.message); } } }, 'Remover'))));
      };
      const add = async (files) => {
        let ok = 0;
        for (const f of files) {
          if (photos.filter((p) => areaOf(p) === area).length >= max) { toast('Limite de ' + max + ' fotos neste item.'); break; }
          try {
            saveEl.textContent = 'Processando foto…';
            const blob = await compress(f);
            const p = { id: uid(), evalId: ev.id, sectionId: area, blob, caption: '', createdAt: now() };
            await photoPut(p); photos.push(p); ok++; draw();
          } catch (e) { toast('Foto não adicionada: ' + e.message); }
        }
        if (ok) { saveEl.textContent = 'Salvo ✓'; ev.updatedAt = now(); evalPut(ev).catch(() => {}); }
      };
      const camIn = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true });
      const galIn = h('input', { type: 'file', accept: 'image/*', multiple: true, hidden: true });
      camIn.addEventListener('change', () => { add([...camIn.files]); camIn.value = ''; });
      galIn.addEventListener('change', () => { add([...galIn.files]); galIn.value = ''; });
      const el = h('div', {},
        h('div', { class: 'row' }, h('button', { type: 'button', onclick: () => camIn.click() }, '📷 Tirar foto'), h('button', { type: 'button', class: 'secondary', onclick: () => galIn.click() }, 'Galeria')),
        camIn, galIn, count, grid);
      boxes.push(draw);
      return el;
    }
    const fichaBox = photoBox(FICHA, 10, 'Ex.: panfleto, ficha técnica, dados gerais');

    // questionário
    const cards = Q.sections.map((s, i) => {
      const a = ev.answers[s.id] || (ev.answers[s.id] = { rating: null, na: false, comment: '' });
      const btns = [];
      const paint = () => btns.forEach((b) => b.classList.toggle('on', b.dataset.v === (a.na ? 'na' : String(a.rating))));
      for (let v = Q.scale.min; v <= Q.scale.max; v++) btns.push(h('button', { type: 'button', 'data-v': String(v), 'aria-label': v + ' – ' + Q.scale.labels[v], onclick: () => { a.rating = a.rating === v && !a.na ? null : v; a.na = false; paint(); updProg(); save(); } }, String(v)));
      btns.push(h('button', { type: 'button', class: 'na', 'data-v': 'na', onclick: () => { a.na = !a.na; if (a.na) a.rating = null; paint(); updProg(); save(); } }, 'N/A'));
      paint();
      const ta = h('textarea', { placeholder: 'Comentários (opcional)', oninput: (e) => { a.comment = e.target.value; save(); } }); ta.value = a.comment || '';
      return h('div', { class: 'card', id: 'sec-' + s.id }, h('h2', {}, (i + 1) + '. ' + s.label),
        h('div', { class: 'scale' }, btns),
        h('div', { class: 'legend' }, h('span', {}, Q.scale.min + ' = ' + Q.scale.labels[Q.scale.min]), h('span', {}, Q.scale.max + ' = ' + Q.scale.labels[Q.scale.max])), ta,
        h('details', { class: 'ph' }, h('summary', {}, '📷 Fotos deste item'), photoBox(s.id, 6, 'Legenda (opcional)')));
    });

    const general = h('textarea', { placeholder: 'Observações gerais (opcional)', oninput: (e) => { ev.generalComment = e.target.value; save(); } }); general.value = ev.generalComment || '';
    const err = h('div', { class: 'err' });

    const finish = async () => {
      err.textContent = '';
      if (!ev.brand) { brand.classList.add('invalid'); err.textContent = 'Informe a marca.'; return brand.scrollIntoView({ block: 'center' }); }
      if (!ev.model) { model.classList.add('invalid'); err.textContent = 'Informe o modelo.'; return model.scrollIntoView({ block: 'center' }); }
      const missing = Q.sections.find((s) => !(ev.answers[s.id].rating != null || ev.answers[s.id].na));
      if (missing) { err.textContent = 'Falta responder: ' + missing.label + '. Use N/A se não se aplica.'; return document.getElementById('sec-' + missing.id).scrollIntoView({ block: 'center' }); }
      if (!photos.some((p) => areaOf(p) === FICHA) && !confirm('Nenhuma foto do panfleto / ficha técnica. Concluir mesmo assim?')) return;
      ev.status = 'done'; clearTimeout(timer); await save(true);
      release(); toast('Avaliação concluída'); screenHome();
    };

    app.replaceChildren(
      h('div', { class: 'card' }, h('h2', {}, 'Caminhão avaliado'),
        h('label', {}, 'Marca *'), brand, h('label', {}, 'Modelo *'), model, dlBrands, dlModels, progWrap,
        ev.status === 'done' ? h('p', { class: 'muted' }, 'Esta avaliação está concluída. Você ainda pode editar.') : null),
      h('div', { class: 'card' }, h('h2', {}, 'Panfleto, ficha técnica e dados gerais'),
        h('p', { class: 'muted' }, 'Fotografe o panfleto de especificações, a ficha técnica e a placa/dados gerais deste caminhão. As fotos de cada item avaliado ficam dentro do próprio item, mais abaixo.'),
        fichaBox),
      ...cards,
      h('div', { class: 'card' }, h('h2', {}, 'Observações gerais'), general),
      err,
      h('button', { class: 'danger block', onclick: async () => { if (!confirm('Excluir esta avaliação e suas fotos?')) return; clearTimeout(timer); await evalDelete(ev.id); release(); screenHome(); } }, 'Excluir avaliação'),
      h('div', { class: 'bar' },
        h('button', { class: 'secondary', onclick: async () => { clearTimeout(timer); await save(true); release(); screenHome(); } }, 'Salvar e sair'),
        h('button', { onclick: finish }, ev.status === 'done' ? 'Concluir de novo' : 'Concluir'))
    );
    boxes.forEach((d) => d()); updProg(); saveEl.textContent = '';
    window.scrollTo(0, 0);
  }

  // ---------- exportação ----------
  const slug = (s, n) => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, n).replace(/-+$/, '');

  async function doExport(evalId) {
    toast('Gerando arquivo…');
    try {
      const evals = (await evalsAll()).filter((e) => e.id === evalId);
      if (!evals.length) throw new Error('avaliação não encontrada');
      const photos = await photosOf(evalId);
      const byEval = {}; photos.forEach((p) => (byEval[p.evalId] = byEval[p.evalId] || []).push(p));
      Object.values(byEval).forEach((l) => l.sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
      const encoder = new TextEncoder();
      const files = [];
      const photoRows = [['ID avaliação', 'Marca', 'Modelo', 'Item', 'Arquivo no ZIP', 'Legenda', 'Tamanho (KB)', 'Data']];
      const labelOf = (id) => id === 'ficha' ? 'Panfleto / ficha técnica / dados gerais' : ((Q.sections.find((s) => s.id === id) || {}).label || id);
      const areaKey = (p) => p.sectionId || 'ficha';
      const manifest = { schemaVersion: 1, exportedAt: now(), questionnaireVersion: Q.version, participant: profile, evaluations: [] };

      for (const e of evals) {
        const list = byEval[e.id] || [], pf = [];
        const n = {};
        for (const p of list) {
          const k = areaKey(p);
          n[k] = (n[k] || 0) + 1;
          const path = 'fotos/' + e.id + '/' + (k === 'ficha' ? '00_ficha_tecnica' : k) + '/foto-' + String(n[k]).padStart(2, '0') + '.jpg';
          // CRC calculado uma foto por vez; o Blob em si não é copiado para a memória.
          const crc = Exporter.crc32(new Uint8Array(await p.blob.arrayBuffer()));
          files.push({ name: path, blob: p.blob, crc, size: p.blob.size });
          pf.push({ item: k, itemLabel: labelOf(k), file: path, caption: p.caption || '', bytes: p.blob.size, createdAt: p.createdAt });
          photoRows.push([e.id, e.brand, e.model, labelOf(k), path, p.caption || '', Math.round(p.blob.size / 1024), fmtDate(p.createdAt)]);
        }
        manifest.evaluations.push({ ...e, photos: pf });
      }

      const wideHead = ['ID avaliação', 'Hora de início', 'Hora de conclusão', 'Status', 'E-mail', 'Nome', 'Função', 'Área', 'Marca', 'Modelo', 'Nº de fotos', 'Versão do questionário', 'Observações gerais', 'Fotos: Panfleto / ficha técnica'];
      Q.sections.forEach((s) => wideHead.push('Nota: ' + s.label, 'Comentários: ' + s.label, 'Fotos: ' + s.label));
      const wide = [wideHead], long = [['ID avaliação', 'Marca', 'Modelo', 'Nome', 'E-mail', 'Item', 'Nota', 'N/A', 'Comentário', 'Nº de fotos do item']];
      for (const e of evals) {
        const row = [e.id, fmtDate(e.createdAt), e.status === 'done' ? fmtDate(e.updatedAt) : '', e.status === 'done' ? 'Concluída' : 'Rascunho', profile.email, profile.name, profile.role, profile.department, e.brand, e.model, (byEval[e.id] || []).length, e.questionnaireVersion, e.generalComment || '', (byEval[e.id] || []).filter((p) => areaKey(p) === 'ficha').length];
        Q.sections.forEach((s) => {
          const a = e.answers[s.id] || {};
          const np = (byEval[e.id] || []).filter((p) => areaKey(p) === s.id).length;
          row.push(a.na ? 'N/A' : (a.rating == null ? '' : a.rating), a.comment || '', np);
          long.push([e.id, e.brand, e.model, profile.name, profile.email, s.label, a.rating == null ? '' : a.rating, a.na ? 'Sim' : '', a.comment || '', np]);
        });
        wide.push(row);
      }
      const xl = Exporter.xlsx([{ name: 'Avaliacoes', rows: wide }, { name: 'Respostas', rows: long }, { name: 'Fotos', rows: photoRows }]);
      files.unshift({ name: 'benchmark_fenatran.xlsx', data: new Uint8Array(await xl.arrayBuffer()) },
        { name: 'dados.json', data: encoder.encode(JSON.stringify(manifest, null, 2)) });
      const blob = Exporter.zip(files);
      const ev0 = evals[0];
      const fileName = 'fenatran_' + (slug(profile.name, 30) || 'avaliador') + '_' + (slug((ev0.brand || '') + ' ' + (ev0.model || ''), 40) || 'caminhao') + '_' + stamp() + '.zip';
      showExportDialog(blob, fileName, ((ev0.brand || '') + ' ' + (ev0.model || '')).trim(), photos.length);
    } catch (e) { toast('Falha ao exportar: ' + e.message); }
  }

  function showExportDialog(blob, fileName, label, nPhotos) {
    const file = new File([blob], fileName, { type: 'application/zip' });
    const url = URL.createObjectURL(blob);
    const isAndroid = /Android/i.test(navigator.userAgent);
    let canShare = false;
    // O Chrome do Android só deixa compartilhar alguns tipos de arquivo (imagem, PDF, texto...) e costuma recusar .zip.
    // O Safari do iPhone aceita. Por isso o botão "Compartilhar" só aparece quando o aparelho diz que consegue.
    try { canShare = !!(navigator.share && navigator.canShare && navigator.canShare({ files: [file] })); } catch (_) { canShare = false; }

    const close = () => { setTimeout(() => URL.revokeObjectURL(url), 1000); m.remove(); };
    const status = h('p', { class: 'muted', 'aria-live': 'polite' }, '');
    const help = isAndroid
      ? 'Android: depois de baixar, abra a notificação do download ou o app Arquivos (pasta Downloads), toque e segure o arquivo, escolha Compartilhar (ou Enviar) e selecione Teams, OneDrive ou Outlook.'
      : 'Depois de baixar, envie o arquivo para a pasta do SharePoint da equipe (ou pelo Teams / Outlook).';

    const download = () => {
      // clique programático num <a>: funciona em Chrome/Android e Safari/iPhone, também com o app instalado
      const a = document.createElement('a');
      a.href = url; a.download = fileName; a.style.display = 'none';
      document.body.append(a); a.click(); a.remove();
      status.textContent = 'Download iniciado. ' + help;
    };
    const share = async () => {
      try {
        await navigator.share({ files: [file], title: 'Benchmark FENATRAN' });
      } catch (err) {
        if (err && err.name === 'AbortError') return; // a pessoa fechou a folha de compartilhamento
        download();
        status.textContent = 'Este aparelho não permitiu compartilhar o arquivo direto, então o ZIP foi baixado. ' + help;
      }
    };

    const m = h('div', { class: 'modal' }, h('div', {},
      h('h2', {}, 'Arquivo pronto'),
      h('p', {}, h('b', {}, label), ' | ' + nPhotos + ' fotos | ' + (blob.size / 1048576).toFixed(1) + ' MB'),
      h('p', { class: 'muted' }, fileName),
      h('p', { class: 'muted' }, 'Envie para o canal indicado pela equipe organizadora. Os dados continuam no aparelho até você apagá-los.'),
      canShare ? h('button', { type: 'button', class: 'block', onclick: share }, 'Compartilhar…') : null,
      h('button', { type: 'button', class: canShare ? 'secondary block' : 'block', onclick: download }, 'Baixar ZIP'),
      canShare ? null : h('p', { class: 'muted' }, isAndroid
        ? 'No Android o navegador não deixa compartilhar arquivos ZIP direto do app. Toque em Baixar ZIP e depois compartilhe o arquivo baixado.'
        : 'Este navegador não permite compartilhar o arquivo direto. Toque em Baixar ZIP.'),
      status,
      h('button', { type: 'button', class: 'secondary block', onclick: close }, 'Fechar')));
    document.body.append(m);
  }

  // ---------- init ----------
  async function init() {
    try {
      db = await openDB();
      profile = await kvGet('profile');
      if (profile && 'area' in profile) { // perfil de versão antiga: 'área de atuação' virou 'Função'
        if (!profile.role) profile.role = Q.profile.roles.includes(profile.area) ? profile.area : '';
        delete profile.area; await kvSet('profile', profile);
      }
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
      if (profile) screenHome(); else screenProfile(true);
    } catch (e) {
      app.replaceChildren(h('div', { class: 'card' }, h('h2', {}, 'Não foi possível abrir o armazenamento'),
        h('p', {}, 'Este app precisa de armazenamento local. Saia da navegação privada e tente de novo. Detalhe: ' + e.message)));
    }
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  init();
})();
