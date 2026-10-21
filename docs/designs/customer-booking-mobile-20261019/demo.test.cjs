/* Run: node --test docs/designs/customer-booking-mobile-20261019/demo.test.cjs
 * Behavioral checks against the actual scripts with a minimal DOM mock.
 * These checks do not verify browser layout, native controls or screenshots.
 */
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const read = name => readFileSync(path.join(__dirname,name),'utf8');

function harness({url='http://127.0.0.1:3112/', storage=new Map(), blockedStorage=false}={}) {
  let currentURL = new URL(url);
  const listeners = {};
  const windowListeners = {};
  let document;
  const content = {scrollTop:0};
  const heading = {focus() { document.activeElement = heading; }};
  const parseButtons = html => [...html.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)].map(match => {
    const attributes = Object.fromEntries([...match[1].matchAll(/([\w-]+)(?:="([^"]*)")?/g)].map(item => [item[1],item[2] ?? '']));
    const dataset = Object.fromEntries(Object.entries(attributes).filter(([name]) => name.startsWith('data-')).map(([name,value]) => [name.slice(5).replace(/-([a-z])/g,(_,c) => c.toUpperCase()),value]));
    return {
      dataset, disabled:Object.hasOwn(attributes,'disabled'), html:match[2],
      matches:selector => selector === 'button',
      focus() { document.activeElement = this; },
      getAttribute:name => attributes[name],
    };
  });
  // A closest() result must be the same concrete control as the event target.
  const makeButtons = html => parseButtons(html).map(button => { button.closest = () => button; return button; });
  function container() {
    let html = '';
    return {buttons:[],get innerHTML() { return html; },set innerHTML(value) { html = value; this.buttons = makeButtons(value); content.scrollTop = 0; }};
  }
  const elements = {
    app:container(), 'study-nav':container(), 'demo-language':{value:'en',matches:() => false}, announcer:{textContent:''},
  };
  const translatedNodes = [...read('index.html').matchAll(/data-i18n="([^"]+)"/g)].map(match => ({dataset:{i18n:match[1]},innerHTML:''}));
  const labelledNodes = [...read('index.html').matchAll(/data-i18n-label="([^"]+)"/g)].map(match => ({dataset:{i18nLabel:match[1]},attributes:{},setAttribute(name,value) { this.attributes[name] = value; }}));
  document = {
    documentElement:{lang:'en'}, title:'', activeElement:null,
    addEventListener(name,listener) { listeners[name] = listener; },
    getElementById(id) { assert.ok(elements[id],`Unexpected element: ${id}`); return elements[id]; },
    querySelectorAll(selector) { return selector === '[data-i18n]' ? translatedNodes : selector === '[data-i18n-label]' ? labelledNodes : []; },
    querySelector(selector) {
      if (selector === '.content') return content;
      if (selector === '#app h2') return heading;
      const attribute = selector.match(/\[data-([\w-]+)="([^"]+)"\]/);
      if (attribute) return elements.app.buttons.find(button => button.dataset[attribute[1].replace(/-([a-z])/g,(_,c) => c.toUpperCase())] === attribute[2]) || null;
      return null;
    },
  };
  const location = {
    get href() { return currentURL.href; }, get pathname() { return currentURL.pathname; },
    get search() { return currentURL.search; }, get hash() { return currentURL.hash; },
    set hash(value) { currentURL.hash = value; },
  };
  const context = vm.createContext({
    document, location, URL, URLSearchParams, Intl,
    history:{replaceState(_state,_title,value) { currentURL = new URL(value,currentURL); }},
    localStorage:{getItem(key) { if (blockedStorage) throw Error('blocked'); return storage.get(key) ?? null; },setItem(key,value) { if (blockedStorage) throw Error('blocked'); storage.set(key,value); }},
    CSS:{escape:value => value},
    window:{addEventListener(name,listener) { windowListeners[name] = listener; }},
    fetch() { throw Error('Demo must not fetch'); },
  });
  vm.runInContext(read('locales.js'),context,{filename:'locales.js'});
  vm.runInContext(read('app.js'),context,{filename:'app.js'});
  const evaluate = expression => vm.runInContext(expression,context);
  function dispatchClick(button) {
    const previousHash = location.hash;
    document.activeElement = button;
    listeners.click({target:button});
    if (location.hash !== previousHash) windowListeners.hashchange();
  }
  return {
    context, evaluate, elements, document, storage, location, content, translatedNodes, labelledNodes,
    get html() { return elements.app.innerHTML; },
    get screen() { return evaluate('screen'); },
    get state() { return JSON.parse(evaluate('JSON.stringify(state)')); },
    text(key) { return evaluate(`t(${JSON.stringify(key)})`); },
    click(key,value) {
      const button = [...elements.app.buttons,...elements['study-nav'].buttons].find(item => item.dataset[key] === value);
      assert.ok(button,`Missing button ${key}=${value} on ${this.screen}`);
      dispatchClick(button);
    },
    action(action) { const button = {dataset:{action},disabled:false,matches:() => true}; button.closest = () => button; dispatchClick(button); },
    injectedChoice(key,value) { const button = {dataset:{[key]:value},disabled:false,matches:() => true}; button.closest = () => button; dispatchClick(button); },
    change(id,value) {
      const target = id === 'consent' ? {id,checked:value} : Object.assign(elements[id],{id,value});
      document.activeElement = target;
      listeners.change({target});
    },
    visit(route) { location.hash = route; windowListeners.hashchange(); },
  };
}
function toReview(app,{service='cut',staff='min',day='22',time='10:00'}={}) {
  app.click('action','start-demo');
  app.click('service',service);
  app.click('action','staff');
  app.click('staff',staff);
  app.click('action','time');
  app.click('day',day);
  app.click('time',time);
  app.click('action','review');
  assert.equal(app.screen,'review');
}
function confirm(app) { app.change('consent',true); app.click('action','confirm'); assert.equal(app.screen,'result'); }

test('entry exposes five instructions, Start demo and default English', () => {
  const app = harness();
  assert.equal(app.screen,'start');
  assert.equal(app.document.documentElement.lang,'en');
  assert.match(app.html,/Start demo/);
  assert.equal((app.html.match(/class="walkthrough-number"/g) || []).length,5);
  assert.match(app.html,/22 or 23 October/);
  app.click('action','start-demo');
  assert.equal(app.screen,'services');
});

test('service → staff → time → consent → confirmation → cancellation', () => {
  const app = harness();
  toReview(app,{service:'color',staff:'ji',day:'23',time:'14:30'});
  assert.match(app.html,/14:30–16:30/);
  assert.match(app.html,/₩150,000/);
  assert.match(app.html,/₩10,000/);
  assert.match(app.html,/₩140,000/);
  app.click('action','confirm');
  assert.equal(app.state.booked,null);
  app.action('confirm');
  assert.equal(app.state.booked,null,'Event guard must also enforce consent');
  confirm(app);
  assert.equal(app.state.booked.service.id,'color');
  app.click('action','bookings');
  app.click('go','cancel');
  assert.match(app.html,/Amount actually paid/);
  assert.match(app.html,/₩0/);
  app.click('action','cancel-confirm');
  assert.equal(app.screen,'bookings');
  assert.equal(app.state.booked.cancelled,true);
  assert.match(app.html,/No payment was made or refunded/);
  app.visit('result'); assert.equal(app.screen,'bookings');
  app.visit('cancel'); assert.equal(app.screen,'bookings');
});

test('direct route guards require staff, an available time and a booking', () => {
  const app = harness({url:'http://127.0.0.1:3112/#review'});
  assert.equal(app.screen,'staff');
  app.click('staff','min');
  app.visit('review'); assert.equal(app.screen,'time');
  app.visit('result'); assert.equal(app.screen,'bookings');
  app.visit('cancel'); assert.equal(app.screen,'bookings');
  app.visit('unknown'); assert.equal(app.screen,'start');
});

test('closed days, fully booked Saturday and disabled slots cannot be booked', () => {
  const app = harness();
  app.click('action','start-demo'); app.click('action','staff'); app.click('staff','min'); app.click('action','time');
  app.click('day','20'); assert.equal(app.state.day,null);
  app.injectedChoice('day','21'); assert.equal(app.state.day,null);
  app.click('day','24'); assert.match(app.html,/No times left on Saturday/);
  app.injectedChoice('time','10:00'); assert.equal(app.state.time,null);
  app.click('day','23'); app.click('time','10:30'); assert.equal(app.state.time,null);
  app.injectedChoice('time','15:00'); assert.equal(app.state.time,null);
  app.injectedChoice('time','99:99'); assert.equal(app.state.time,null);
  app.click('time','11:00'); app.click('action','review'); assert.equal(app.screen,'review');
});

test('service and staff changes clear downstream selections and consent', () => {
  const app = harness(); toReview(app); app.change('consent',true);
  app.click('go','staff'); app.click('staff','ji');
  assert.equal(app.state.day,null); assert.equal(app.state.time,null); assert.equal(app.state.consent,false);
  app.click('go','services'); app.click('service','spa');
  assert.equal(app.state.staff,null); app.click('action','staff');
  assert.ok(!app.elements.app.buttons.some(button => button.dataset.staff === 'ji'));
  app.injectedChoice('staff','ji'); assert.equal(app.state.staff,null);
});

test('expired selection cannot confirm and recovery requires a new time and consent', () => {
  const app = harness(); toReview(app); app.change('consent',true);
  app.click('action','expire');
  assert.equal(app.state.expired,true); assert.equal(app.state.consent,false);
  app.change('consent',true); app.action('confirm'); assert.equal(app.state.booked,null);
  app.click('action','recover'); assert.equal(app.screen,'time');
  assert.equal(app.state.time,null); assert.equal(app.state.consent,false);
  app.click('time','13:00'); app.click('action','review'); confirm(app);
  assert.equal(app.state.booked.time,'13:00');
});

test('reset clears booking and choices while preserving language', () => {
  const app = harness(); toReview(app); confirm(app); app.change('demo-language','ja');
  app.action('reset');
  assert.equal(app.screen,'start'); assert.equal(app.state.booked,null); assert.equal(app.state.staff,null);
  assert.equal(app.document.documentElement.lang,'ja');
  assert.deepEqual([...app.storage.keys()],['myseouldrop-demo-language']);
});

test('saved and empty states remain usable', () => {
  const app = harness(); app.visit('saved'); assert.match(app.html,/Something caught your eye/);
  app.click('go','services'); app.click('action','save'); app.visit('saved'); assert.match(app.html,/venue-row/);
  app.visit('explore'); app.click('category','nails'); assert.match(app.html,/No sample nail salons/);
  app.click('category','hair'); app.click('category','headSpa'); app.click('go','services');
  assert.equal(app.state.service,'spa');
});

test('choice refresh retains scroll and keyboard focus', () => {
  const app = harness(); app.click('action','start-demo'); app.content.scrollTop = 175;
  app.click('service','spa');
  assert.equal(app.content.scrollTop,175);
  assert.equal(app.document.activeElement.dataset.service,'spa');
});

for (const locale of ['en','ja','zh-CN','es','fr']) {
  test(`${locale}: full flow, policies, dates and side notes translate without losing booking`, () => {
    const app = harness({url:`http://127.0.0.1:3112/?lang=${locale}`});
    assert.equal(app.document.documentElement.lang,locale);
    assert.match(app.html,new RegExp(app.text('startDemo')));
    assert.ok(app.translatedNodes.every(node => node.innerHTML === app.text(node.dataset.i18n)));
    assert.ok(app.labelledNodes.every(node => node.attributes['aria-label'] === app.text(node.dataset.i18nLabel)));
    toReview(app,{service:'spa',time:'14:30'});
    assert.ok(app.html.includes(app.text('spa')));
    assert.ok(app.html.includes(app.text('appointmentTotal')));
    assert.ok(app.html.includes(app.text('policyBody')));
    assert.ok(app.html.includes(app.text('consent')));
    assert.match(app.html,/14:30–15:45/);
    confirm(app);
    assert.ok(app.html.includes(app.text('sampleBalance')));
    app.change('demo-language',locale === 'en' ? 'fr' : 'en');
    assert.equal(app.screen,'result');
    assert.equal(app.state.booked.service.id,'spa');
    assert.equal(app.state.booked.time,'14:30');
    assert.ok(app.html.includes(app.text('spa')));
    app.change('demo-language',locale);
    app.click('action','bookings'); app.click('go','cancel');
    assert.ok(app.html.includes(app.text('cancelNote')));
    assert.ok(app.html.includes(app.text('notApplicable')));
    app.click('action','cancel-confirm');
    assert.ok(app.html.includes(app.text('noRefund')));
    assert.doesNotMatch(app.html,/undefined|\{(?:minutes|person|start|end|price|service|number)\}/);
  });
}

test('native-language choices persist and URL language takes precedence after reload', () => {
  const storage = new Map();
  const first = harness({storage}); toReview(first); first.change('consent',true);
  const before = first.state;
  first.change('demo-language','ja');
  assert.deepEqual(first.state,before);
  assert.match(first.location.search,/lang=ja/);
  const reload = harness({url:first.location.href,storage});
  assert.equal(reload.document.documentElement.lang,'ja');
  assert.equal(reload.state.booked,null,'Booking data must never be persisted');
  assert.equal(harness({storage}).document.documentElement.lang,'ja');
  assert.equal(harness({url:'http://127.0.0.1:3112/?lang=es',storage}).document.documentElement.lang,'es');
  assert.equal(harness({url:'http://127.0.0.1:3112/?lang=invalid'}).document.documentElement.lang,'en');
});

test('denied browser storage still supports language changes and the full flow', () => {
  const app = harness({blockedStorage:true});
  app.change('demo-language','fr'); toReview(app); confirm(app);
  assert.equal(app.document.documentElement.lang,'fr');
});

test('all five catalogs contain every key, consistent interpolation and all rendered messages', () => {
  const app = harness();
  const catalogs = JSON.parse(app.evaluate('JSON.stringify(DemoLocale.catalogs)'));
  const keys = Object.keys(catalogs.en).sort();
  for (const [locale,catalog] of Object.entries(catalogs)) {
    assert.deepEqual(Object.keys(catalog).sort(),keys);
    for (const key of keys) {
      assert.ok(typeof catalog[key] === 'string' && catalog[key].trim(),`${locale}: ${key}`);
      assert.deepEqual((catalog[key].match(/\{\w+\}/g) || []).sort(),(catalogs.en[key].match(/\{\w+\}/g) || []).sort(),`${locale}: ${key} placeholders`);
    }
  }
  const directKeys = [...read('app.js').matchAll(/\bt\('([^']+)'(?:[,)])/g)].map(match => match[1]);
  for (const key of directKeys) assert.ok(catalogs.en[key],`Missing literal message: ${key}`);
  for (const locale of Object.keys(catalogs)) {
    app.change('demo-language',locale);
    for (const route of ['start','explore','services','staff','time','review','result','cancel','bookings']) {
      app.click('preview',route);
      assert.doesNotMatch(app.html,/undefined|\{(?:minutes|person|start|end|price|service|number)\}/,`${locale}: ${route}`);
    }
  }
});
