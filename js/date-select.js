(() => {
  'use strict';
  const selects = [...document.querySelectorAll('#F-01 .f01__date-field select')];
  if (!selects.length) return;
  const menu = document.createElement('div');
  menu.id = 'f01-date-menu';
  menu.className = 'f01__date-menu';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  document.body.appendChild(menu);
  let opened = null, highlighted = 0, anchor = null, buffer = '', typedAt = 0;
  const controls = [];

  function close(restoreFocus = false) {
    if (!opened) return;
    const trigger = opened.trigger;
    trigger.setAttribute('aria-expanded', 'false');
    trigger.removeAttribute('aria-activedescendant');
    menu.hidden = true;
    opened = null;
    buffer = '';
    if (restoreFocus) trigger.focus({ preventScroll: true });
  }
  function highlight(index) {
    if (!opened) return;
    highlighted = Math.max(0, Math.min(opened.select.options.length - 1, index));
    [...menu.children].forEach((option, i) => option.classList.toggle('is-highlighted', i === highlighted));
    const option = menu.children[highlighted];
    if (!option) return;
    opened.trigger.setAttribute('aria-activedescendant', option.id);
    option.scrollIntoView({ block: 'nearest' });
  }
  function open(control) {
    close();
    opened = control;
    buffer = '';
    const { select, trigger } = control;
    menu.replaceChildren(...[...select.options].map((option, i) => {
      const item = document.createElement('div');
      item.id = `${select.id}-option-${i}`;
      item.className = 'f01__date-option';
      item.dataset.index = i;
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(option.selected));
      item.textContent = option.textContent;
      return item;
    }));
    menu.setAttribute('aria-labelledby', trigger.id);
    trigger.setAttribute('aria-expanded', 'true');
    const rect = trigger.getBoundingClientRect();
    anchor = { x: rect.x, y: rect.y };
    const width = Math.max(select.id === 'f01-year' ? 108 : 84, rect.width + 12);
    const below = innerHeight - rect.bottom - 12, above = rect.top - 12;
    const upward = below < 220 && above > below;
    menu.style.width = `${Math.min(width, innerWidth - 16)}px`;
    menu.style.maxHeight = `${Math.max(60, Math.min(264, upward ? above : below))}px`;
    menu.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, rect.left))}px`;
    menu.hidden = false;
    menu.style.top = `${upward ? rect.top - menu.offsetHeight - 6 : rect.bottom + 6}px`;
    highlight(Math.max(0, select.selectedIndex));
  }
  function commit() {
    if (!opened) return;
    const { select } = opened;
    const value = select.options[highlighted]?.value;
    close(true);
    if (value === undefined) return;
    select.value = value;
    select.dispatchEvent(new Event('input', { bubbles: true }));
    select.dispatchEvent(new Event('change', { bubbles: true }));
    sync();
  }
  function sync() {
    controls.forEach(({ select, trigger }) => {
      trigger.textContent = select.selectedOptions[0]?.textContent || '—';
      if (select.hasAttribute('aria-invalid')) trigger.setAttribute('aria-invalid', select.getAttribute('aria-invalid'));
      else trigger.removeAttribute('aria-invalid');
    });
  }
  selects.forEach(select => {
    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.id = `${select.id}-trigger`;
    trigger.className = 'f01__date-trigger';
    trigger.dataset.select = select.id;
    trigger.setAttribute('role', 'combobox');
    trigger.setAttribute('aria-label', select.getAttribute('aria-label'));
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-controls', menu.id);
    trigger.setAttribute('aria-expanded', 'false');
    select.insertAdjacentElement('afterend', trigger);
    select.classList.add('f01__native-select');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    const control = { select, trigger };
    controls.push(control);
    trigger.addEventListener('pointerdown', event => event.stopPropagation());
    trigger.addEventListener('click', () => { if (opened === control) close(); else open(control); });
    trigger.addEventListener('blur', () => { if (opened === control) close(); });
    select.addEventListener('focus', () => trigger.focus({ preventScroll: true }));
    select.addEventListener('change', sync);
    new MutationObserver(sync).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-invalid'] });
    trigger.addEventListener('keydown', event => {
      event.stopPropagation();
      const key = event.key;
      if (key === 'Tab') { close(); return; }
      if (key === 'Escape') { event.preventDefault(); close(true); return; }
      if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp', 'Enter', ' '].includes(key)) {
        event.preventDefault();
        if (opened !== control) { open(control); return; }
        if (key === 'Enter' || key === ' ') { commit(); return; }
        if (key === 'ArrowDown') highlight(highlighted + 1);
        if (key === 'ArrowUp') highlight(highlighted - 1);
        if (key === 'Home') highlight(0);
        if (key === 'End') highlight(select.options.length - 1);
        if (key === 'PageDown') highlight(highlighted + 8);
        if (key === 'PageUp') highlight(highlighted - 8);
        return;
      }
      if (/^\d$/.test(key)) {
        event.preventDefault();
        if (opened !== control) open(control);
        buffer = performance.now() - typedAt < 800 ? buffer + key : key;
        typedAt = performance.now();
        const index = [...select.options].findIndex(option => option.textContent.startsWith(buffer));
        if (index >= 0) highlight(index);
      }
    });
  });
  menu.addEventListener('pointerdown', event => event.preventDefault());
  menu.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse') return;
    const option = event.target.closest('[data-index]');
    if (option) highlight(Number(option.dataset.index));
  });
  menu.addEventListener('click', event => {
    const option = event.target.closest('[data-index]');
    if (!option) return;
    highlighted = Number(option.dataset.index);
    commit();
  });
  menu.addEventListener('wheel', event => event.stopPropagation(), { passive: true });
  document.addEventListener('pointerdown', event => {
    if (opened && !menu.contains(event.target) && !opened.trigger.contains(event.target)) close();
  }, true);
  document.addEventListener('scroll', event => { if (opened && event.target !== menu) close(); }, true);
  window.addEventListener('resize', () => close());
  document.addEventListener('visibilitychange', () => { if (document.hidden) close(); });
  new MutationObserver(() => {
    if (!opened) return;
    const rect = opened.trigger.getBoundingClientRect();
    if (Math.abs(rect.x - anchor.x) > 1 || Math.abs(rect.y - anchor.y) > 1) {
      const trigger = opened.trigger;
      close();
      trigger.blur();
    }
  }).observe(document.getElementById('track'), { attributes: true, attributeFilter: ['style'] });
  sync();
})();
