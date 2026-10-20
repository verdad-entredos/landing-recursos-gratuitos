export function initializeEnvelope(documentRef = document) {
  const opener = documentRef.getElementById('envelope-toggle');
  const dialog = documentRef.getElementById('resource-dialog');
  const preview = documentRef.getElementById('resource-preview');
  const closeButton = documentRef.getElementById('preview-close');
  const mailbox = documentRef.getElementById('mailbox-scene');
  const actionLabel = documentRef.getElementById('envelope-toggle-label');

  if (!opener || !dialog || !preview || !closeButton || !mailbox || !actionLabel) return false;
  if (typeof dialog.showModal !== 'function' || typeof dialog.close !== 'function') return false;

  const page = documentRef.defaultView;
  const bodyStyle = documentRef.body.style;
  const rootStyle = documentRef.documentElement.style;
  let scrollSnapshot = null;

  function lockPageScroll() {
    if (scrollSnapshot || !page) return;

    scrollSnapshot = {
      left: page.scrollX,
      top: page.scrollY,
      body: {
        position: bodyStyle.position,
        top: bodyStyle.top,
        left: bodyStyle.left,
        width: bodyStyle.width,
        overflow: bodyStyle.overflow,
      },
      root: {
        overflow: rootStyle.overflow,
        scrollBehavior: rootStyle.scrollBehavior,
      },
    };

    bodyStyle.position = 'fixed';
    bodyStyle.top = `${-scrollSnapshot.top}px`;
    bodyStyle.left = `${-scrollSnapshot.left}px`;
    bodyStyle.width = '100%';
    bodyStyle.overflow = 'hidden';
    rootStyle.overflow = 'hidden';
    rootStyle.scrollBehavior = 'auto';
  }

  function restorePageScroll() {
    if (!scrollSnapshot) return;

    const snapshot = scrollSnapshot;
    scrollSnapshot = null;
    rootStyle.scrollBehavior = 'auto';
    Object.assign(bodyStyle, snapshot.body);
    rootStyle.overflow = snapshot.root.overflow;
    page.scrollTo({ left: snapshot.left, top: snapshot.top, behavior: 'instant' });
    rootStyle.scrollBehavior = snapshot.root.scrollBehavior;
  }

  function setOpen(isOpen) {
    opener.setAttribute('aria-expanded', String(isOpen));
    actionLabel.textContent = isOpen ? 'Cerrar el sobre' : 'Abrir el sobre';
    mailbox.setAttribute('data-open', String(isOpen));
    dialog.setAttribute('data-opening', String(isOpen));

    if (!isOpen) opener.focus({ preventScroll: true });
  }

  function finishClosing() {
    if (dialog.open) return;
    restorePageScroll();
    if (dialog.getAttribute('data-opening') === 'true') setOpen(false);
  }

  function closeDialog() {
    if (!dialog.open) return;
    dialog.close();
    finishClosing();
  }

  opener.addEventListener('click', () => {
    if (dialog.open) return;
    lockPageScroll();
    try {
      dialog.showModal();
      setOpen(true);
    } catch (error) {
      restorePageScroll();
      throw error;
    }
  });
  closeButton.addEventListener('click', closeDialog);
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    closeDialog();
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;

    const focusable = Array.from(dialog.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'))
      .filter((element) => !element.hidden && !element.disabled && element.getClientRects().length > 0);
    if (focusable.length === 0) {
      event.preventDefault();
      closeButton.focus({ preventScroll: true });
      return;
    }

    const currentIndex = focusable.indexOf(documentRef.activeElement);
    if (event.shiftKey && currentIndex <= 0) {
      event.preventDefault();
      focusable.at(-1).focus();
    } else if (!event.shiftKey && (currentIndex === focusable.length - 1 || currentIndex < 0)) {
      event.preventDefault();
      focusable[0].focus();
    }
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) closeDialog();
  });
  dialog.addEventListener('close', finishClosing);

  actionLabel.textContent = 'Abrir el sobre';
  mailbox.setAttribute('data-open', 'false');
  dialog.setAttribute('data-opening', 'false');
  opener.hidden = false;
  return true;
}

export function initializeBookReveal(documentRef = document, ObserverConstructor = globalThis.IntersectionObserver) {
  const targets = Array.from(documentRef.querySelectorAll('.book-collection [data-reveal]'));
  const reducedMotion = documentRef.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if (targets.length === 0 || !ObserverConstructor || reducedMotion) return false;

  try {
    for (const target of targets) target.setAttribute('data-reveal', 'waiting');
    const observer = new ObserverConstructor((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.setAttribute('data-reveal', 'visible');
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
    for (const target of targets) observer.observe(target);
    return true;
  } catch {
    for (const target of targets) target.setAttribute('data-reveal', 'visible');
    return false;
  }
}

function startEnhancement() {
  initializeEnvelope(document);
  initializeBookReveal(document);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startEnhancement, { once: true });
  } else {
    startEnhancement();
  }
}
