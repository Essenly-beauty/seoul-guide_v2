/* Local demo only. No API, reservation, payment or messaging calls. */
const icons = {
 back:'<path d="m14 6-6 6 6 6M8 12h13"/>',arrow:'<path d="M4 12h16m-6-6 6 6-6 6"/>',search:'<circle cx="10" cy="10" r="6.5"/><path d="m15 15 5 5"/>',pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',calendar:'<rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16m-11 5h2m2 0h2"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',check:'<path d="m5 12 5 5L20 7"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',heart:'<path d="M20 5c-3-3-7-1-8 1-1-2-5-4-8-1-5 5 8 15 8 15S25 10 20 5Z"/>',info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10h.01"/>',scissors:'<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="m8 8 13 13M8 16 21 3"/>',globe:'<circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>'
};
const icon = name => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${icons[name] || icons.info}</svg>`;
const t = (key, values) => DemoLocale.t(key, values);
function mapGraphic(){return `<svg class="map-graphic" viewBox="0 0 390 310" preserveAspectRatio="xMidYMid slice" aria-label="${t('mapLabel')}"><rect width="390" height="310" fill="#eeeee9"/><path d="M-30 210 390 320M20-20l180 350M160-20l180 350M290-20l140 300M-20 135 340-10M-20 240 400 60" stroke="#fff" stroke-width="12"/><path d="m55 40 320 160M-20 90l350 190M-20 170l250 140M90-20l160 330M220-20l160 330M-10 280 390 115M-20 185 390 20" stroke="#fafaf7" stroke-width="5"/><path d="m0 270 60-12 35 52H0Z" fill="#d7e0cf"/><path d="m215 0 22 50 58-25-13-25" fill="#d7e0cf"/><path d="m-20 200 430-183" stroke="#ced4c5" stroke-width="3"/><circle cx="194" cy="108" r="5" fill="#488561"/><text x="207" y="112" class="map-label">${t('seongsuStation')}</text><text x="44" y="245" class="map-label">${t('seoulForest')}</text><text x="233" y="238" class="map-label">${t('seongsu')}</text><circle cx="116" cy="216" r="13" fill="#c5d7ff" opacity=".6"/><circle cx="116" cy="216" r="5" fill="#4475c3" stroke="white" stroke-width="2"/></svg>`;}
const stages = ['start','explore','services','staff','time','review','result','bookings','cancel'];
const services = [
  { id:'cut', price:60000, minutes:60, category:'hair' },
  { id:'spa', price:90000, minutes:75, category:'headSpa' },
  { id:'color', price:150000, minutes:120, category:'hair' },
];
const people = [
  { id:'min', name:'Min', initial:'M', services:['cut','spa','color'] },
  { id:'ji', name:'Jiyoon', initial:'J', services:['cut','color'] },
];
const availableTimes = ['10:00','11:00','13:00','14:30','16:00','17:00','18:00'];
const defaults = () => ({ service:'cut', staff:null, day:null, time:null, consent:false, booked:null, saved:false, category:'hair', expired:false });
let state = defaults();
let screen = 'start';
const money = n => `₩${n.toLocaleString(DemoLocale.intl)}`;
const compactMoney = n => `₩${new Intl.NumberFormat(DemoLocale.intl,{notation:'compact',maximumFractionDigits:1}).format(n)}`;
const duration = minutes => t('duration', {minutes});
const service = () => services.find(item => item.id === state.service);
const person = () => people.find(item => item.id === state.staff);
const endTime = () => {
  const [h,m] = (state.time || '10:00').split(':').map(Number);
  const end = h * 60 + m + service().minutes;
  return `${String(Math.floor(end / 60)).padStart(2,'0')}:${String(end % 60).padStart(2,'0')}`;
};
const hasAppointment = () => !!(person()?.services.includes(state.service) && [22,23].includes(state.day) && availableTimes.includes(state.time));
const sampleDate = day => new Date(Date.UTC(2026,9,day,3));
const formatDate = (day, options) => new Intl.DateTimeFormat(DemoLocale.intl, {...options, timeZone:'Asia/Seoul'}).format(sampleDate(day));
const dateText = (day = state.day) => formatDate(day, {weekday:'short',day:'numeric',month:'short',year:'numeric'});
const bookedService = b => t(b.service.id);
const withPerson = b => t('withPerson', {service:bookedService(b), person:b.staff.name});
const statusbar = () => '<div class="statusbar" aria-hidden="true"><span>9:41</span><svg viewBox="0 0 44 12"><path d="M1 10V7h2v3m2 0V5h2v5m2 0V3h2v7m2 0V1h2v9" stroke="currentColor" stroke-width="1.7"/><rect x="23" y="2" width="17" height="8" rx="2" fill="none" stroke="currentColor"/><path d="M41 4v4" stroke="currentColor" stroke-width="2"/><rect x="25" y="4" width="13" height="4" rx=".5" fill="currentColor"/></svg></div>';
const topbar = (title, back='services') => `<header class="topbar"><button class="icon-button" data-go="${back}" aria-label="${t('back')}">${icon('back')}</button><span class="title">${title}</span><button class="icon-button" data-go="explore" aria-label="${t('closeBooking')}">${icon('close')}</button></header>`;
const nav = active => `<nav class="nav-bottom" aria-label="${t('mainNavigation')}">${[['explore','pin'],['bookings','calendar'],['saved','heart']].map(([id,ic]) => `<button data-go="${id}" ${active === id ? 'aria-current="page"' : ''}>${icon(ic)}${t(id)}</button>`).join('')}</nav>`;
const cta = (label, action, disabled=false) => `<button class="primary" data-action="${action}" ${disabled ? 'disabled' : ''}>${label}${icon('arrow')}</button>`;
const heading = (step, title, sub) => `<div class="step-label"><i></i>${step}</div><h2 tabindex="-1">${title}</h2>${sub ? `<p class="subtitle">${sub}</p>` : ''}`;
const summaryFooter = (label, action, disabled=false) => `<footer class="footer"><div class="footer-summary"><span>${t(service().id)}<br><small>${duration(service().minutes)} · ${t('totalPrice')}</small></span><strong>${money(service().price)}</strong></div>${cta(label,action,disabled)}</footer>`;
function startScreen() {
  const steps = [['services','instructionServices'],['staff','instructionStaff'],['time','instructionTime'],['review','instructionReview'],['result','instructionComplete']];
  return `${statusbar()}<header class="topbar"><span class="wordmark">MYSEOUL<span>DROP</span><i></i></span><span class="tag">${t('demo')}</span></header>
    <div class="content"><div class="page start-page">${heading(t('demo'),t('startTitle'),t('startIntro'))}
      <ol class="walkthrough">${steps.map(([label,description],i) => `<li><span class="walkthrough-number" aria-hidden="true">${i + 1}</span><div><strong>${t(label)}</strong><p>${t(description)}</p></div></li>`).join('')}</ol>
      <p class="choice-hint">${icon('info')}${t('demoNote')}</p>
    </div></div><footer class="footer">${cta(t('startDemo'),'start-demo')}<button class="text-button explore-link" data-go="explore">${t('exploreMap')}</button></footer>`;
}
function explore() {
  return `${statusbar()}<div class="map-screen"><div class="map">${mapGraphic()}
    <button class="map-search" data-action="search">${icon('search')}<span>${t('mapSearch')}</span></button>
    <button class="pin active" style="top:145px;left:160px" data-go="services" aria-label="${t('viewSalon')}">${compactMoney(60000)}</button>
    <button class="pin" style="top:95px;left:48px" data-action="spa" aria-label="${t('viewSpa')}">${compactMoney(90000)}</button>
    <span class="map-note">${t('mapNote')}</span></div><section class="map-sheet"><div class="handle" aria-hidden="true"></div>
    <div class="row"><h2 class="grow" tabindex="-1">${t('beautyAround')}</h2><span class="tag">${t('seongsu')}</span></div>
    <div class="chips">${['hair','headSpa','nails'].map(category => `<button class="chip ${state.category === category ? 'active' : ''}" data-category="${category}" aria-pressed="${state.category === category}">${category === 'hair' ? icon('scissors') : ''}${t(category)}</button>`).join('')}</div>
    ${state.category === 'nails' ? `<div class="empty"><h3>${t('moreSpots')}</h3><p>${t('noNails')}</p><button class="secondary" data-category="hair">${t('exploreHair')}</button></div>` : venueRow()}
    <p class="caption map-caption">${t('exploreCaption')}</p></section></div>${nav('explore')}`;
}
function venueRow() {
  return `<button class="venue-row" data-go="services"><img class="venue-thumb" src="assets/studio.webp" alt="${t('salonAlt')}"><div class="grow"><span class="tag">${t('englishAvailable')}</span><h3>Seoul Studio</h3><p class="caption">${t('venueCategory')}</p><span class="price">${t('fromPrice',{price:money(state.category === 'headSpa' ? 90000 : 60000)})}<span class="caption"> ${t('perService')}</span></span></div>${icon('arrow')}</button>`;
}
function serviceScreen() {
  return `${statusbar()}${topbar('Seoul Studio','explore')}<div class="content"><img class="venue-photo" src="assets/studio.webp" alt="${t('salonPhotoAlt')}"><div class="page venue-header"><span class="tag">${t('englishAvailable')}</span><h2 tabindex="-1">Seoul Studio</h2><p class="subtitle">${t('venueIntro')}</p>
    <div class="venue-info"><span>${icon('pin')}${t('location')}</span><span>${icon('globe')}${t('spokenLanguages')}</span></div>
    <div class="section-title"><h3>${t('chooseService')}</h3><span>${t('priceCurrency')}</span></div>
    <div role="group" aria-label="${t('services')}">${services.map(item => `<button class="menu-item ${state.service === item.id ? 'selected' : ''}" data-service="${item.id}" aria-pressed="${state.service === item.id}"><span class="grow"><h3>${t(item.id)}</h3><p>${t(item.id + 'Description')}</p><span class="price">${money(item.price)}</span><span class="duration">${duration(item.minutes)}</span></span><span class="selection" aria-hidden="true"></span></button>`).join('')}</div>
    <div class="choice-hint">${icon('info')}${t('includedSteps')}</div><button class="text-button" data-action="save">${t(state.saved ? 'savedPlace' : 'savePlace')}</button></div></div>${summaryFooter(t('chooseStaff'),'staff')}`;
}
function staffScreen() {
  const selectedService = service();
  const specialists = people.filter(item => item.services.includes(selectedService.id));
  return `${statusbar()}${topbar(t('appointment'),'services')}<div class="content"><div class="page">
    ${heading(t('step',{number:1}),t('staffTitle'),t('staffSubtitle'))}
    <div class="booking-context">${icon('scissors')}<span>${t(selectedService.id)} · ${duration(selectedService.minutes)}</span></div>
    <div class="staff-list" role="group" aria-label="${t('chooseStaff')}">${specialists.map(item => `<button class="person ${item.id === state.staff ? 'selected' : ''}" data-staff="${item.id}" aria-pressed="${item.id === state.staff}">
      <span class="avatar ${item.id === 'ji' ? 'cool' : ''}" aria-hidden="true">${item.initial}</span><span class="person-info"><span><span class="person-name">${item.name}</span><span class="person-role">${t(item.id + 'Role')}</span></span><span class="person-speciality">${t(item.id + 'Speciality')}</span><span class="person-languages">${icon('globe')}${t('spokenLanguages')}</span></span><span class="selection" aria-hidden="true"></span></button>`).join('')}
    </div><p class="caption staff-caption">${t('staffHint')}</p></div></div>${summaryFooter(t('chooseTime'),'time',!person())}`;
}
function timeScreen() {
  return `${statusbar()}${topbar(t('appointment'),'staff')}<div class="content"><div class="page">${heading(t('step',{number:2}),t('timeTitle'),t('timeSubtitle'))}
    <div class="booking-context">${icon('user')}<span>${person().name} · ${t(service().id)} · ${duration(service().minutes)}</span></div>
    <div class="section-title"><h3>${formatDate(22,{month:'long',year:'numeric'})}</h3><span>${t('sampleAvailability')}</span></div>
    <div class="days" role="group" aria-label="${t('chooseDate')}">${[20,21,22,23,24].map(day => `<button class="day ${state.day === day ? 'selected' : ''}" data-day="${day}" aria-label="${dateText(day)}${day < 22 ? ` · ${t('closed')}` : ''}" aria-pressed="${state.day === day}" ${day < 22 ? 'disabled' : ''}><span>${formatDate(day,{weekday:'short'})}</span><strong>${day}</strong>${day < 22 ? `<span class="closed-label">${t('closed')}</span>` : ''}</button>`).join('')}</div>
    ${state.day === 24 ? `<div class="empty"><h3>${t('noSaturday')}</h3><p>${t('tryFriday')}</p><button class="secondary" data-day="23">${t('seeFriday')}</button></div>` : state.day ? `<p class="time-label">${t('morning')}</p><div class="slots">${['10:00','10:30','11:00'].map(slot).join('')}</div><p class="time-label">${t('afternoon')}</p><div class="slots">${['13:00','14:30','15:00','16:00','17:00','18:00'].map(slot).join('')}</div>` : `<div class="empty"><h3>${t('pickDay')}</h3><p>${t('closedHint')}</p></div>`}
    <div class="choice-hint">${icon('clock')}${state.time ? t('timeSummary',{start:state.time,end:endTime(),minutes:service().minutes,person:person().name}) : t('endTimeHint')}</div></div></div>${summaryFooter(t('reviewAppointment'),'review',!hasAppointment())}`;
}
function slot(time) {
  return `<button class="slot ${state.time === time ? 'selected' : ''}" data-time="${time}" aria-pressed="${state.time === time}" ${!availableTimes.includes(time) ? 'disabled' : ''}>${time}</button>`;
}
function reviewScreen() {
  return `${statusbar()}${topbar(t('reviewAppointment'),'time')}<div class="content"><div class="page">${heading(t('step',{number:3}),t('reviewTitle'),t('reviewSubtitle'))}
    <div class="summary-venue"><img src="assets/studio.webp" alt="${t('sampleSalonAlt')}"><div><h3>Seoul Studio</h3><p>${t('location')}</p></div></div>
    ${state.expired ? `<div class="error" role="alert">${t('expired')}</div>` : ''}
    <div class="detail-row">${icon('scissors')}<div class="grow">${t(service().id)}<small>${duration(service().minutes)} · ${t('allSteps')}</small></div><button class="text-button" data-go="services">${t('edit')}</button></div>
    <div class="detail-row">${icon('user')}<div class="grow">${person().name}<small>${t(person().id + 'Role')} · ${t('englishAvailable')}</small></div><button class="text-button" data-go="staff">${t('edit')}</button></div>
    <div class="detail-row">${icon('calendar')}<div class="grow">${dateText()}<small>${state.time}–${endTime()} · ${t('seoulTime')}</small></div><button class="text-button" data-go="time">${t('edit')}</button></div>
    <div class="amounts"><div class="total"><span>${t('appointmentTotal')}</span><span>${money(service().price)}</span></div><div class="pay-now"><span>${t('depositToday')}</span><strong>${money(10000)}</strong></div><div><span>${t('paySalon')}</span><span>${money(service().price - 10000)}</span></div></div>
    <div class="policy"><span class="tag orange">${t('exampleTerms')}</span><strong>${t('depositTowardTotal')}</strong><p>${t('policyBody')}</p></div>
    <label class="consent"><input id="consent" type="checkbox" ${state.consent ? 'checked' : ''}><span>${t('consent')}</span></label><button class="preview-control" data-action="expire">${t('previewExpired')}</button></div></div>
    <footer class="footer">${state.expired ? cta(t('newTime'),'recover') : cta(t('previewConfirmation'),'confirm',!state.consent)}<p class="caption footer-caption">${t('noCharge')}</p></footer>`;
}
function resultScreen() {
  const booking = state.booked;
  return `${statusbar()}${topbar(t('appointmentPreview'),'bookings')}<div class="content"><div class="page"><div class="success-symbol">${icon('check')}</div>${heading(t('demo'),t('resultTitle'),t('resultSubtitle'))}
    <div class="ticket"><span class="tag green">${t('sampleConfirmation')}</span><h3>Seoul Studio</h3><p>${withPerson(booking)}</p><div class="row">${icon('calendar')}<span>${dateText(booking.day)}<br><span class="caption">${booking.time}–${booking.end} · ${t('seoulTime')}</span></span></div><div class="row">${icon('pin')}<span>${t('location')}<br><span class="caption">${t('directionsHint')}</span></span></div></div>
    <div class="amounts"><div><span>${t('sampleDeposit')}</span><span>${money(10000)}</span></div><div><span>${t('sampleBalance')}</span><span>${money(booking.service.price - 10000)}</span></div></div><div class="choice-hint">${icon('info')}${t('resultNote')}</div></div></div><footer class="footer">${cta(t('viewAppointments'),'bookings')}</footer>`;
}
function bookingsScreen() {
  const booking = state.booked;
  return `${statusbar()}<header class="topbar"><span class="wordmark">MYSEOUL<span>DROP</span><i></i></span><span class="tag">${t('preview')}</span></header><div class="content"><div class="page">${heading(t('yourPlans'),t('bookingsTitle'),t('bookingsSubtitle'))}
    ${booking ? `<article class="booking-row"><span class="tag ${booking.cancelled ? 'gray' : 'green'}">${t(booking.cancelled ? 'cancelledSample' : 'upcomingSample')}</span><h3>Seoul Studio</h3><p>${withPerson(booking)}</p><p class="booking-date">${dateText(booking.day)} · ${booking.time}</p><p class="caption">${t('seoulTime')}</p>
      ${booking.cancelled ? `<div class="policy"><strong>${t('refundStatus')}</strong><p>${t('noRefund')}</p></div>` : `<button class="secondary" data-go="result">${t('viewAppointment')}</button><button class="text-button" data-go="cancel">${t('cancelAppointment')}</button>`}</article>` : `<div class="empty"><h3>${t('emptyBookings')}</h3><p>${t('emptyBookingsBody')}</p><button class="secondary" data-go="explore">${t('exploreSalons')}</button></div>`}
    </div></div>${nav('bookings')}`;
}
function cancelScreen() {
  const booking = state.booked;
  return `${statusbar()}${topbar(t('cancelAppointment'),'bookings')}<div class="content"><div class="page">${heading(t('sampleAppointment'),t('cancelTitle'),t('cancelSubtitle'))}
    <div class="ticket"><h3>Seoul Studio</h3><p>${withPerson(booking)}</p><p>${dateText(booking.day)} · ${booking.time} KST</p></div>
    <div class="amounts"><div><span>${t('amountPaid')}</span><strong>${money(0)}</strong></div><div><span>${t('refundPreview')}</span><strong>${t('notApplicable')}</strong></div></div>
    <div class="choice-hint">${icon('info')}${t('cancelNote')}</div><button class="text-button" data-go="bookings">${t('keepAppointment')}</button></div></div><footer class="footer">${cta(t('cancelSample'),'cancel-confirm')}</footer>`;
}
function savedScreen() {
  return `${statusbar()}${topbar(t('savedPlaces'),'explore')}<div class="content"><div class="page">${heading(t('yourPlaces'),t('savedTitle'),t('savedSubtitle'))}
    ${state.saved ? `<div class="saved-venue">${venueRow()}</div>` : `<div class="empty"><h3>${t('emptySaved')}</h3><p>${t('emptySavedBody')}</p><button class="secondary" data-go="services">${t('exploreStudio')}</button></div>`}</div></div>${nav('saved')}`;
}
function validScreen(target) {
  if (['time','review'].includes(target) && !person()?.services.includes(state.service)) return 'staff';
  if (target === 'review' && !hasAppointment()) return 'time';
  if (['result','cancel'].includes(target) && (!state.booked || state.booked.cancelled)) return 'bookings';
  return [...stages,'saved'].includes(target) ? target : 'start';
}
function renderChrome() {
  document.documentElement.lang = DemoLocale.code;
  document.title = t('pageTitle');
  document.querySelectorAll('[data-i18n]').forEach(element => { element.innerHTML = t(element.dataset.i18n); });
  document.querySelectorAll('[data-i18n-label]').forEach(element => { element.setAttribute('aria-label',t(element.dataset.i18nLabel)); });
  document.getElementById('demo-language').value = DemoLocale.code;
}
function render(focus=true) {
  screen = validScreen(location.hash.slice(1) || 'start');
  if (location.hash !== '#' + screen) history.replaceState(null,'','#' + screen);
  const views = {start:startScreen,explore,services:serviceScreen,staff:staffScreen,time:timeScreen,review:reviewScreen,result:resultScreen,bookings:bookingsScreen,cancel:cancelScreen,saved:savedScreen};
  document.getElementById('app').innerHTML = views[screen]();
  document.getElementById('study-nav').innerHTML = stages.map((id,i) => `<button data-preview="${id}" ${screen === id ? 'aria-current="step"' : ''}><span>${String(i + 1).padStart(2,'0')}</span>${t(id)}</button>`).join('');
  renderChrome();
  if (focus) document.querySelector('#app h2')?.focus({preventScroll:true});
}
function go(target) {
  target = validScreen(target);
  if (location.hash === '#' + target) render();
  else location.hash = target;
}
function refresh() {
  const y = document.querySelector('.content')?.scrollTop || 0;
  const active = document.activeElement;
  const identity = active?.matches('button') ? Object.entries(active.dataset).find(([key]) => ['service','staff','day','time','category','action','go'].includes(key)) : null;
  render(false);
  const content = document.querySelector('.content');
  if (content) content.scrollTop = y;
  if (identity) document.querySelector(`#app button[data-${identity[0]}="${CSS.escape(identity[1])}"]`)?.focus({preventScroll:true});
}
function resetDownstream() { state.day = null; state.time = null; state.consent = false; state.expired = false; }
function bookSample() {
  state.booked = {service:{...service()},staff:{...person()},day:state.day,time:state.time,end:endTime(),cancelled:false};
}
function seedPreview(target) {
  if (['time','review','result','cancel'].includes(target)) { state.staff = 'min'; state.day = 22; state.time = '10:00'; state.consent = false; state.expired = false; }
  if (['result','cancel'].includes(target)) bookSample();
  go(target);
}
document.addEventListener('click', event => {
  const element = event.target.closest('button,a');
  if (!element || element.disabled) return;
  const data = element.dataset;
  if (data.go) return go(data.go);
  if (data.preview) return seedPreview(data.preview);
  if (data.category && ['hair','headSpa','nails'].includes(data.category)) {
    state.category = data.category;
    if (data.category !== 'nails') {
      state.service = data.category === 'headSpa' ? 'spa' : 'cut'; state.staff = null; resetDownstream();
    }
    return refresh();
  }
  if (data.service && services.some(item => item.id === data.service)) {
    if (state.service !== data.service) { state.service = data.service; state.staff = null; resetDownstream(); }
    return refresh();
  }
  if (data.staff && people.some(item => item.id === data.staff && item.services.includes(state.service))) {
    if (state.staff !== data.staff) { state.staff = data.staff; resetDownstream(); }
    return refresh();
  }
  if (data.day && [22,23,24].includes(Number(data.day))) {
    state.day = Number(data.day); state.time = null; state.consent = false; state.expired = false; return refresh();
  }
  if (data.time && [22,23].includes(state.day) && availableTimes.includes(data.time)) {
    state.time = data.time; state.consent = false; state.expired = false; return refresh();
  }
  switch (data.action) {
    case 'reset': state = defaults(); return go('start');
    case 'start-demo': return go('services');
    case 'search': return go('services');
    case 'spa': state.category = 'headSpa'; state.service = 'spa'; state.staff = null; resetDownstream(); return go('services');
    case 'save': state.saved = !state.saved; document.getElementById('announcer').textContent = t(state.saved ? 'placeSaved' : 'placeRemoved'); return refresh();
    case 'expire': state.expired = true; state.consent = false; return refresh();
    case 'recover': state.time = null; state.expired = false; state.consent = false; return go('time');
    case 'confirm': if (state.consent && !state.expired && hasAppointment()) { bookSample(); go('result'); } return;
    case 'cancel-confirm': if (state.booked) state.booked.cancelled = true; return go('bookings');
    default: if (data.action) go(data.action);
  }
});
document.addEventListener('change', event => {
  if (event.target.id === 'consent') {
    state.consent = event.target.checked;
    const button = document.querySelector('[data-action="confirm"]');
    if (button) button.disabled = !state.consent;
  }
  if (event.target.id === 'demo-language' && DemoLocale.set(event.target.value)) {
    document.getElementById('announcer').textContent = '';
    refresh();
  }
});
window.addEventListener('hashchange', () => render());
render(false);
