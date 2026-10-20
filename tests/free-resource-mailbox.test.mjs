import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';

const projectRoot = resolve(import.meta.dirname, '..');
const sourceRoot = '/home/julian/proyectos/verdad-entre-dos/5_citas_5_recuerdos';
const digitalPdf = '5_citas_5_recuerdos.pdf';
const printPdf = '5_citas_5_recuerdos_imprimible.pdf';

async function readSiteFile(path) {
  return readFile(resolve(projectRoot, path), 'utf8');
}

test('the landing page introduces the published resource, keeps direct downloads available, and stages the preview in a dialog', async () => {
  const html = await readSiteFile('dist/index.html');

  assert.match(html, /5 citas, 5 recuerdos/);
  assert.match(html, /recursos gratuitos/i);
  assert.match(html, /Cinco experiencias para salir de la rutina y volver a disfrutar de nosotros\./);
  assert.match(html, /La mesa de las cosas pequeñas/);
  assert.match(html, /50–70 MINUTOS/);
  assert.match(html, new RegExp(`href="downloads/${digitalPdf}"`));
  assert.match(html, new RegExp(`href="downloads/${printPdf}"`));
  const primaryLinkIndex = html.indexOf(`href="downloads/${digitalPdf}"`);
  const previewIndex = html.indexOf('id="resource-preview"');
  assert.ok(primaryLinkIndex >= 0 && primaryLinkIndex < previewIndex, 'the main download must precede the modal preview');
  assert.match(html, /<dialog\b[^>]*id="resource-dialog"[^>]*aria-labelledby="preview-heading"/);
  assert.match(html, /id="resource-preview"[^>]*aria-labelledby="preview-heading"/);
  assert.match(html, /id="preview-close"[^>]*autofocus/);
  const primaryAnchor = html.match(/<a\b[^>]*class="[^"]*download-link[^"]*"[^>]*>/);
  assert.ok(primaryAnchor, "the page must show a primary download link");
  assert.match(primaryAnchor[0], new RegExp(`href="downloads/${digitalPdf}"`));
  assert.doesNotMatch(html, /<form\b|mailto:|testimonial|testimonio/i);
});

test('the browser can load a local favicon without a missing-resource request', async () => {
  const html = await readSiteFile('dist/index.html');
  assert.match(html, /rel="icon" href="assets\/favicon\.svg"/);
  const favicon = await readFile(resolve(projectRoot, 'dist/assets/favicon.svg'), 'utf8');
  assert.match(favicon, /<svg\b/);
});

test('the two public PDFs are byte-for-byte copies of the verified source files', async () => {
  for (const fileName of [digitalPdf, printPdf]) {
    const [actual, original] = await Promise.all([
      readFile(resolve(projectRoot, 'dist/downloads', fileName)),
      readFile(resolve(sourceRoot, fileName)),
    ]);
    assert.deepEqual(actual, original, `${fileName} must remain byte-identical to the source edition`);
  }
});

test('the envelope controller opens the native modal, synchronizes its physical state, and restores focus on close', async () => {
  const { initializeEnvelope } = await import('../dist/app.js');
  const opener = new FakeElement();
  const dialog = new FakeDialog();
  const preview = new FakeElement();
  const close = new FakeElement();
  const mailbox = new FakeElement();
  const actionLabel = new FakeElement();
  const document = new FakeDocument();
  opener.hidden = true;
  opener.setAttribute('aria-expanded', 'false');
  document.elements.set('envelope-toggle', opener);
  document.elements.set('resource-dialog', dialog);
  document.elements.set('resource-preview', preview);
  document.elements.set('preview-close', close);
  document.elements.set('mailbox-scene', mailbox);
  document.elements.set('envelope-toggle-label', actionLabel);
  dialog.closeFocusTarget = close;

  initializeEnvelope(document);

  assert.equal(opener.hidden, false, 'the control is enabled only after a controller is attached');
  assert.equal(actionLabel.textContent, 'Abrir el sobre', 'the enabled control has a visible action label');
  assert.equal(mailbox.getAttribute('data-open'), 'false');
  document.activeElement = opener;
  opener.click();
  assert.equal(dialog.open, true);
  assert.equal(dialog.showModalCount, 1);
  assert.equal(opener.getAttribute('aria-expanded'), 'true');
  assert.equal(actionLabel.textContent, 'Cerrar el sobre');
  assert.equal(mailbox.getAttribute('data-open'), 'true');
  assert.equal(document.activeElement, close, 'opening moves focus into the modal');

  close.click();
  assert.equal(dialog.open, false);
  assert.equal(opener.getAttribute('aria-expanded'), 'false');
  assert.equal(actionLabel.textContent, 'Abrir el sobre');
  assert.equal(mailbox.getAttribute('data-open'), 'false');
  assert.equal(document.activeElement, opener);
  assert.deepEqual(opener.focusOptions, { preventScroll: true });

  opener.click();
  dialog.dispatch('cancel', { preventDefault() {} });
  assert.equal(dialog.open, false, 'the native Escape cancellation closes the modal');
  assert.equal(mailbox.getAttribute('data-open'), 'false');
  assert.equal(document.activeElement, opener);
});

test('the modal opener stays unavailable when native modal support is missing', async () => {
  const { initializeEnvelope } = await import('../dist/app.js');
  const document = makeEnvelopeDocument({ dialog: new FakeElement() });

  assert.equal(initializeEnvelope(document), false);
  assert.equal(document.getElementById('envelope-toggle').hidden, true);
});

test('modal dismissal restores the exact page position and pre-existing inline scroll styles', async () => {
  const { initializeEnvelope } = await import('../dist/app.js');

  for (const dismissal of ['close', 'escape', 'backdrop']) {
    const document = makeEnvelopeDocument();
    const { dialog, close } = configureModalFocus(document);
    const { body, documentElement, defaultView } = document;
    body.style.position = 'relative';
    body.style.top = '3px';
    body.style.left = '4px';
    body.style.width = '92%';
    body.style.overflow = 'clip';
    documentElement.style.overflow = 'scroll';
    documentElement.style.scrollBehavior = 'smooth';
    defaultView.scrollX = 18;
    defaultView.scrollY = 74;

    initializeEnvelope(document);
    document.getElementById('envelope-toggle').click();

    assert.equal(body.style.position, 'fixed', `${dismissal} locks the body while the dialog is open`);
    assert.equal(body.style.top, '-74px');
    assert.equal(documentElement.style.overflow, 'hidden');

    if (dismissal === 'close') close.click();
    if (dismissal === 'escape') dialog.dispatch('cancel', { preventDefault() {} });
    if (dismissal === 'backdrop') dialog.dispatch('click', { target: dialog });

    assert.equal(body.style.position, 'relative', `${dismissal} restores the original body position style`);
    assert.equal(body.style.top, '3px');
    assert.equal(body.style.left, '4px');
    assert.equal(body.style.width, '92%');
    assert.equal(body.style.overflow, 'clip');
    assert.equal(documentElement.style.overflow, 'scroll');
    assert.equal(documentElement.style.scrollBehavior, 'smooth');
    assert.deepEqual(defaultView.scrollCalls.at(-1), { left: 18, top: 74, behavior: 'instant' });
    assert.equal(defaultView.scrollX, 18);
    assert.equal(defaultView.scrollY, 74);
  }
});

test('modal Tab and Shift+Tab wrap within its focusable controls', async () => {
  const { initializeEnvelope } = await import('../dist/app.js');
  const document = makeEnvelopeDocument();
  const { dialog, close, digitalLink, printLink } = configureModalFocus(document);
  initializeEnvelope(document);
  document.getElementById('envelope-toggle').click();

  dialog.dispatch('keydown', keyboardEvent('Tab', true));
  assert.equal(document.activeElement, printLink, 'Shift+Tab from the first modal control wraps to the last');

  dialog.dispatch('keydown', keyboardEvent('Tab', false));
  assert.equal(document.activeElement, close, 'Tab from the last modal control wraps to the first');

  document.activeElement = document.body;
  dialog.dispatch('keydown', keyboardEvent('Tab', false));
  assert.equal(document.activeElement, close, 'focus that escapes the dialog is recovered to its first control');

  document.activeElement = document.body;
  dialog.dispatch('keydown', keyboardEvent('Tab', true));
  assert.equal(document.activeElement, printLink, 'reverse focus that escapes the dialog is recovered to its last control');
});

test('the closing book module uses the verified cover and examples and links to the exact sales page', async () => {
  const html = await readSiteFile('dist/index.html');
  const moduleStart = html.indexOf('<section class="book-collection"');
  const moduleEnd = html.indexOf('</section>', moduleStart) + '</section>'.length;
  const footerStart = html.indexOf('<footer class="site-footer"');
  assert.ok(moduleStart >= 0 && moduleEnd > moduleStart && moduleEnd < footerStart, 'the closing module belongs before the footer');
  const module = html.slice(moduleStart, moduleEnd);

  assert.match(module, /Su historia merece <em>más momentos así\.<\/em>/);
  assert.match(module, /Salgan de la rutina/);
  assert.match(module, /src="assets\/100-citas-una-historia-cover\.png"/);
  assert.match(module, /Que decida la moneda/);
  assert.match(module, /El mapa de lo que aún no sé/);
  assert.match(module, /La canción que nos encontró/);
  assert.match(module, /<a\b[^>]*href="https:\/\/100citas-unahistoria\.vercel\.app\/"[^>]*>\s*Conoce las 100 citas/);
  assert.doesNotMatch(module, /href="https:\/\/100citas-unahistoria\.vercel\.app\/"[^>]*\bdownload\b/);

  const cover = await readFile(resolve(projectRoot, 'dist/assets/100-citas-una-historia-cover.png'));
  assert.deepEqual(cover.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const styles = await readSiteFile('dist/styles.css');
  assert.match(styles, /\.book-note--coin\s*\{[^}]*--reveal-angle:\s*-5deg/s);
  assert.match(styles, /\.book-collection \[data-reveal="waiting"\]\s*\{[^}]*transform:\s*translateY\(22px\) rotate\(var\(--reveal-angle, 0deg\)\)/s);
});

test('the optional book reveal remains visible without IntersectionObserver and reveals on entry when available', async () => {
  const { initializeBookReveal } = await import('../dist/app.js');
  const plainElement = new RevealElement();
  const noObserverDocument = { querySelectorAll: () => [plainElement], defaultView: { matchMedia: () => ({ matches: false }) } };

  assert.equal(initializeBookReveal(noObserverDocument, undefined), false);
  assert.equal(plainElement.getAttribute('data-reveal'), null, 'unsupported browsers keep the content in its visible default state');

  let observeCallback;
  const observerCalls = [];
  class FakeObserver {
    constructor(callback) { observeCallback = callback; }
    observe(element) { observerCalls.push(['observe', element]); }
    unobserve(element) { observerCalls.push(['unobserve', element]); }
  }
  const element = new RevealElement();
  const reducedDocument = { querySelectorAll: () => [element], defaultView: { matchMedia: () => ({ matches: true }) } };
  assert.equal(initializeBookReveal(reducedDocument, FakeObserver), false, 'reduced-motion users do not receive a hidden entrance state');
  assert.equal(element.getAttribute('data-reveal'), null);

  const animatedDocument = { querySelectorAll: () => [element], defaultView: { matchMedia: () => ({ matches: false }) } };
  assert.equal(initializeBookReveal(animatedDocument, FakeObserver), true);
  assert.equal(element.getAttribute('data-reveal'), 'waiting');
  assert.deepEqual(observerCalls, [['observe', element]]);
  observeCallback([{ target: element, isIntersecting: true }]);
  assert.equal(element.getAttribute('data-reveal'), 'visible');
  assert.deepEqual(observerCalls.at(-1), ['unobserve', element]);
});

test('modal download actions state that each link downloads a PDF', async () => {
  const html = await readSiteFile('dist/index.html');
  const preview = html.match(/<section class="letter-preview"[\s\S]*?<\/section>/)?.[0] ?? '';
  assert.match(preview, /href="downloads\/5_citas_5_recuerdos\.pdf"[^>]*download>[\s\S]*?Descargar PDF/);
  assert.match(preview, /href="downloads\/5_citas_5_recuerdos_imprimible\.pdf"[^>]*download>[\s\S]*?Descargar versión para imprimir/);
});

test('keyboard users can reach the sales CTA without passing through a hidden reveal state', async () => {
  const html = await readSiteFile('dist/index.html');
  const copyOpeningTag = html.match(/<div class="book-collection__copy"[^>]*>/)?.[0] ?? '';
  assert.ok(copyOpeningTag, 'the CTA copy container exists');
  assert.doesNotMatch(copyOpeningTag, /\bdata-reveal\b/, 'copy with the focusable CTA is visible before decorative reveals run');
  assert.match(html, /<figure class="book-collection__book" data-reveal>/, 'the book artwork retains its entrance animation');
});

test('Escape cancellation closes synchronously and releases the page scroll lock', async () => {
  const { initializeEnvelope } = await import('../dist/app.js');
  const document = makeEnvelopeDocument();
  const { dialog } = configureModalFocus(document);
  initializeEnvelope(document);
  document.getElementById('envelope-toggle').click();

  const cancelEvent = keyboardEvent('cancel', false);
  dialog.dispatch('cancel', cancelEvent);

  assert.equal(cancelEvent.defaultPrevented, true, 'the cancel handler takes ownership to clean up before focus restoration');
  assert.equal(dialog.closeCount, 1);
  assert.equal(dialog.open, false);
  assert.equal(document.body.style.position, '');
  assert.equal(document.getElementById('envelope-toggle').getAttribute('aria-expanded'), 'false');
});

function configureModalFocus(document) {
  const dialog = document.getElementById('resource-dialog');
  const close = document.getElementById('preview-close');
  const digitalLink = new FakeElement();
  const printLink = new FakeElement();
  digitalLink.ownerDocument = document;
  printLink.ownerDocument = document;
  dialog.focusableElements = [close, digitalLink, printLink];
  dialog.closeFocusTarget = close;
  return { dialog, close, digitalLink, printLink };
}

function keyboardEvent(key, shiftKey) {
  return {
    key,
    shiftKey,
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
  };
}

function makeEnvelopeDocument({ dialog = new FakeDialog() } = {}) {
  const document = new FakeDocument();
  const opener = new FakeElement();
  opener.hidden = true;
  document.elements.set('envelope-toggle', opener);
  document.elements.set('resource-dialog', dialog);
  document.elements.set('resource-preview', new FakeElement());
  document.elements.set('preview-close', new FakeElement());
  document.elements.set('mailbox-scene', new FakeElement());
  document.elements.set('envelope-toggle-label', new FakeElement());
  return document;
}

class FakeElement {
  attributes = new Map();
  listeners = new Map();
  hidden = false;
  disabled = false;
  style = { position: '', top: '', left: '', width: '', overflow: '', scrollBehavior: '' };

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  setAttribute(name, value) {
    this.attributes.set(name, value);
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  focus() {
    this.ownerDocument.activeElement = this;
    this.focusOptions = arguments[0];
  }

  getClientRects() {
    return this.hidden ? [] : [{}];
  }

  click() {
    this.listeners.get('click')?.({ preventDefault() {} });
  }
}

class FakeDialog extends FakeElement {
  open = false;
  showModalCount = 0;
  closeCount = 0;
  closeFocusTarget = null;
  focusableElements = [];

  showModal() {
    this.open = true;
    this.showModalCount += 1;
    this.closeFocusTarget?.focus();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.closeCount += 1;
    this.dispatch('close', {});
  }

  querySelectorAll() {
    return this.focusableElements;
  }

  dispatch(type, event) {
    this.listeners.get(type)?.(event);
    if (type === 'cancel' && !event.defaultPrevented) this.close();
  }
}

class FakeDocument {
  elements = new Map();
  listeners = new Map();
  activeElement = null;
  body = new FakeElement();
  documentElement = new FakeElement();
  defaultView = { scrollX: 0, scrollY: 0, scrollCalls: [] };

  constructor() {
    this.defaultView.scrollTo = (position) => {
      this.defaultView.scrollCalls.push(position);
      this.defaultView.scrollX = position.left;
      this.defaultView.scrollY = position.top;
    };
  }

  getElementById(id) {
    const element = this.elements.get(id);
    if (element) element.ownerDocument = this;
    return element ?? null;
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  dispatch(type, event) {
    this.listeners.get(type)?.(event);
  }
}

class RevealElement {
  attributes = new Map();

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
}
