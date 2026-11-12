const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const indexUrl = pathToFileURL(path.join(root, 'index.html')).href;
const output = '/tmp/freight-ui-after';
const chromePath = process.env.CHROME_BIN || [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Users/alex/Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell'
].find(file => fs.existsSync(file));

async function assertNoDocumentOverflow(page, label) {
  const result = await page.evaluate(() => ({
    width: innerWidth,
    height: innerHeight,
    docWidth: document.documentElement.scrollWidth,
    docHeight: document.documentElement.scrollHeight,
    bodyWidth: document.body.scrollWidth,
    bodyHeight: document.body.scrollHeight,
    deviceWidth: document.querySelector('.device').getBoundingClientRect().width
  }));
  assert(result.docWidth <= result.width + 1, `${label}: document horizontal overflow ${JSON.stringify(result)}`);
  assert(result.docHeight <= result.height + 1, `${label}: document vertical overflow ${JSON.stringify(result)}`);
  assert(result.bodyWidth <= result.width + 1, `${label}: body horizontal overflow ${JSON.stringify(result)}`);
  assert(result.deviceWidth <= result.width + 1, `${label}: device exceeds viewport ${JSON.stringify(result)}`);
  return result;
}
async function screenshot(page, name) {
  await page.screenshot({ path: path.join(output, name), fullPage: false });
}
async function signIn(page, phone = '+7 777 123 45 67') {
  await page.locator('#loginPhone').fill(phone);
  await page.locator('#loginCode').fill('246810');
  await page.locator('#loginForm button[type="submit"]').click();
  await page.locator('#homeScreen').waitFor({ state: 'visible' });
}
async function logOut(page) {
  await page.locator('[data-nav="profile"]').click();
  await page.locator('#logoutButton').click();
  await page.locator('#authScreen').waitFor({ state: 'visible' });
}
async function register(page, { name, phone, email, role }) {
  await page.locator('#registerTab').click();
  await page.locator('#registerName').fill(name);
  await page.locator('#registerPhone').fill(phone);
  await page.locator('#registerEmail').fill(email);
  await page.locator(`[data-register-role="${role}"]`).click();
  await page.locator('#registerForm button[type="submit"]').click();
  await page.locator('#homeScreen').waitFor({ state: 'visible' });
}

(async () => {
  assert(chromePath, 'Set CHROME_BIN to Chrome or install a cached Playwright Chromium');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--allow-file-access-from-files'] });
  try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
  context.setDefaultTimeout(8000);
  const page = await context.newPage();
  const errors = [];
  const externalRequests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (/^https?:/i.test(request.url())) externalRequests.push(request.url()); });

  await page.goto(indexUrl);
  assert.match(page.url(), /^file:/, 'app must run directly from file://');
  await page.locator('#loginCode').fill('246810');
  await page.locator('#loginForm button[type="submit"]').click();
  await page.locator('#homeScreen').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#homeHeading').innerText(), 'Доброе утро, Алексей');
  assert.equal(await page.locator('#homeActionText').evaluate(element => element.textContent), 'Создать заказ');
  assert.equal(await page.locator('.bottom-nav [aria-current="page"]').getAttribute('data-nav'), 'home');
  await screenshot(page, 'home-390.png');
  assert.equal(await page.locator('#reportChart .bar-item').count(), 6);
  await page.locator('[data-range="quarter"]').click();
  assert.equal(await page.locator('#reportChart .bar-item').count(), 4);
  await page.locator('[data-range="year"]').click();
  assert.equal(await page.locator('#reportChart .bar-item').count(), 3);
  await page.locator('[data-range="month"]').click();
  assert((await page.locator('#chartNote').innerText()).includes('неполный'));

  await page.locator('[data-nav="orders"]').click();
  await page.locator('#ordersScreen').waitFor({ state: 'visible' });
  const fixtureIds = new Set();
  for (const tab of ['active', 'waiting', 'completed', 'cancelled']) {
    await page.locator(`[data-filter="${tab}"]`).click();
    const ids = await page.locator('#ordersList .order-item').evaluateAll(items => items.map(item => item.dataset.orderId));
    assert.equal(ids.length, Number(await page.locator(`[data-count="${tab}"]`).innerText()));
    ids.forEach(id => { assert(!fixtureIds.has(id), `duplicate fixture ${id}`); fixtureIds.add(id); });
  }
  await page.locator('[data-filter="active"]').click();
  assert(Number(await page.locator('[data-count="active"]').innerText()) >= 1);
  assert(Number(await page.locator('[data-count="waiting"]').innerText()) >= 1);
  assert(Number(await page.locator('[data-count="completed"]').innerText()) >= 1);
  assert(Number(await page.locator('[data-count="cancelled"]').innerText()) >= 1);
  await screenshot(page, 'orders-390.png');
  const firstActive = page.locator('#ordersList .order-item').first();
  const firstActiveId = await firstActive.getAttribute('data-order-id');
  await firstActive.click();
  await page.locator('#detailScreen').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#detailHeading').innerText(), `Заказ ${firstActiveId}`);
  assert.equal(await page.locator('#mapLink').getAttribute('href'), 'https://2gis.ru/directions/tab/truck/points/76.8512,43.2220|73.1094,49.8047');
  assert((await page.locator('#mapNotice').innerText()).includes('геопозиция не подключены'));
  await screenshot(page, 'detail-390.png');
  await page.locator('[data-back]').click();
  await page.locator('#ordersScreen').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#ordersList .order-item').first().getAttribute('data-order-id'), firstActiveId, 'back returns to the same order list');

  await page.locator('[data-filter="waiting"]').click();
  await page.locator('#monthFilter').selectOption({ label: 'Все месяцы' });
  assert(Number(await page.locator('[data-count="waiting"]').innerText()) >= 1);
  const waitingId = await page.locator('#ordersList .order-item').first().getAttribute('data-order-id');
  await page.locator('#ordersList .order-item').first().click();
  assert.equal(await page.locator('#detailHeading').innerText(), `Заказ ${waitingId}`);
  assert.equal(await page.locator('#mapLink').getAttribute('href'), 'https://2gis.ru/directions/tab/truck/points/76.8512,43.2220|73.1094,49.8047');
  await page.locator('[data-back]').click();
  await page.locator('[data-filter="cancelled"]').click();
  const cancelledId = await page.locator('#ordersList .order-item').first().getAttribute('data-order-id');
  await page.locator('#ordersList .order-item').first().click();
  assert.equal(await page.locator('#detailHeading').innerText(), `Заказ ${cancelledId}`);
  await page.locator('[data-back]').click();
  await page.locator('[data-filter="completed"]').click();
  await page.locator('#monthFilter').selectOption({ index: 1 });
  await page.locator('#monthFilter').selectOption('all');
  assert((await page.locator('#ordersList .order-item').count()) >= 1);

  await page.locator('[data-nav="create"]').click();
  await page.locator('#createScreen').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#currency').inputValue(), 'KZT');
  await screenshot(page, 'create-390.png');
  await page.locator('#origin').fill('Алматы');
  await page.locator('#destination').fill('Караганда');
  for (const invalid of ['0', '-1', 'NaN', 'Infinity', '1e3', '1.234,56', '99999999999999999999', '9007199254740993,99', '1000000000000000000000000000000000000000']) {
    await page.locator('#amount').fill(invalid);
    await page.locator('#createForm button[type="submit"]').click();
    assert.equal(await page.locator('#amount').getAttribute('aria-invalid'), 'true', `must reject ${invalid}`);
    assert.equal(await page.locator('#createScreen').isVisible(), true, `invalid ${invalid} must not publish`);
    assert(!(await page.locator('#toast').innerText()).includes('добавлен'));
  }
  await page.locator('#amount').fill('1 234,56');
  await page.locator('#weight').fill('18,5');
  await page.locator('#volume').fill('82');
  await page.locator('#currency').selectOption('KZT');
  await page.locator('[data-nav="home"]').click();
  await page.locator('[data-nav="create"]').click();
  assert.equal(await page.locator('#amount').inputValue(), '1 234,56', 'the create draft survives tab navigation');
  await page.locator('#createForm button[type="submit"]').click();
  await page.locator('#ordersScreen').waitFor({ state: 'visible' });
  await page.locator('[data-filter="waiting"]').click();
  const createdKzt = page.locator('#ordersList .order-item').filter({ hasText: '1 234,56' }).first();
  await createdKzt.waitFor({ state: 'visible' });
  const createdKztId = await createdKzt.getAttribute('data-order-id');
  assert(!fixtureIds.has(createdKztId), 'published IDs must not collide with existing orders');
  assert((await createdKzt.innerText()).includes('₸'));
  await createdKzt.click();
  assert.equal(await page.locator('#detailHeading').innerText(), `Заказ ${createdKztId}`);
  assert.equal(await page.locator('#mapLink').count(), 1);
  assert.equal(await page.locator('#mapLink').getAttribute('href'), 'https://2gis.ru/directions/tab/truck/points/76.8512,43.2220|73.1094,49.8047');
  assert((await page.locator('#mapNotice').innerText()).includes('только точки А и Б'));
  const fileNames = [path.join(root, 'assets/profile-portrait.webp'), path.join(root, 'assets/vehicle-truck.webp')];
  await page.locator('#documentInput').setInputFiles(fileNames[0]);
  assert((await page.locator('#documentState').innerText()).includes('Файл добавлен'));
  await page.locator('#cargoPhotoInput').setInputFiles(fileNames);
  assert.equal(await page.locator('#cargoPhotoCount').innerText(), '2 фото');
  await page.locator('#openCargoPhotos').click();
  await page.locator('#photoViewer').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#photoCounter').innerText(), '1 из 2');
  await page.locator('#nextPhoto').click();
  assert.equal(await page.locator('#photoCounter').innerText(), '2 из 2');
  await page.keyboard.press('Escape');
  await page.locator('#detailScreen').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'openCargoPhotos');
  await page.goBack();
  await page.locator('#ordersScreen').waitFor({ state: 'visible' });
  await page.locator('[data-nav="create"]').click();
  await page.locator('#origin').fill('Алматы');
  await page.locator('#destination').fill('Караганда');
  await page.locator('#amount').fill('9876,54');
  await page.locator('#currency').selectOption('USD');
  await page.locator('#createForm button[type="submit"]').click();
  await page.locator('[data-filter="waiting"]').click();
  const createdUsd = page.locator('#ordersList .order-item').filter({ hasText: '$' }).first();
  await createdUsd.waitFor({ state: 'visible' });
  assert((await createdUsd.innerText()).includes('$'));

  await page.locator('[data-nav="profile"]').click();
  await page.locator('#profileScreen').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#vehicleSection').isVisible(), false, 'customers do not see vehicle details');
  assert.equal(await page.locator('#profileRole').innerText(), 'Заказчик');
  assert.equal(await page.locator('#profileEmail').innerText(), 'alexey@example.com');
  await screenshot(page, 'profile-390.png');
  await page.locator('#openProfilePhotos').click();
  await page.locator('#photoViewer').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#photoCounter').innerText(), '1 из 1');
  await screenshot(page, 'photos-390.png');
  await page.keyboard.press('Escape');
  await page.locator('#profileScreen').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate(() => document.activeElement.id), 'openProfilePhotos');
  await page.locator('#profilePhotoInput').setInputFiles(fileNames);
  await page.locator('#openProfilePhotos').click();
  await page.locator('#photoViewer').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#photoCounter').innerText(), '1 из 3');
  await page.locator('#nextPhoto').click();
  assert.equal(await page.locator('#photoCounter').innerText(), '2 из 3');
  await page.goBack();
  await page.locator('#profileScreen').waitFor({ state: 'visible' });

  await logOut(page);
  await register(page, { name: 'Данияр Сапаров', phone: '+7 701 111 22 33', email: 'carrier@example.com', role: 'carrier' });
  assert.equal(await page.locator('#roleLabel').innerText(), 'Перевозчик');
  assert.equal(await page.locator('#metricOrders').innerText(), '0', 'available offers are not owned trips');
  await page.locator('[data-nav="profile"]').click();
  assert.equal(await page.locator('#vehicleSection').isVisible(), true);
  await page.locator('[data-nav="orders"]').click();
  await page.locator('[data-filter="active"]').click();
  assert.equal(await page.locator('#ordersList .order-item').count(), 0, 'carrier must not inherit another carrier\'s active trips');
  await page.locator('[data-nav="create"]').click();
  assert.equal(await page.locator('#ordersScreen').isVisible(), true, 'carrier action opens available orders, not creation');
  assert.equal(await page.locator('[data-filter="waiting"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.bottom-nav [aria-current="page"]').getAttribute('data-nav'), 'create');
  assert.equal(await page.locator('#ordersHeading').innerText(), 'Доступные заказы');
  const offer = page.locator('#ordersList .order-item').first();
  const offerId = await offer.getAttribute('data-order-id');
  await offer.click();
  assert.equal(await page.locator('#detailHeading').innerText(), `Заказ ${offerId}`);
  assert.equal(await page.locator('#cargoPhotoInput').isDisabled(), true, 'unassigned carriers cannot edit another order');
  await page.locator('#advanceOrder').click();
  assert.equal(await page.locator('#detailStatus').innerText(), 'Перевозчик назначен');
  await page.locator('#advanceOrder').click();
  assert.equal(await page.locator('#detailStatus').innerText(), 'Погрузка');
  assert.notEqual(await page.locator('#loadingTime').innerText(), '—');
  await page.locator('#advanceOrder').click();
  assert.equal(await page.locator('#detailStatus').innerText(), 'В пути');
  assert.notEqual(await page.locator('#departedTime').innerText(), '—');
  assert.equal(await page.locator('#deliveredTime').innerText(), '—');
  await page.locator('#advanceOrder').click();
  assert.equal(await page.locator('#detailStatus').innerText(), 'Завершён');
  assert.notEqual(await page.locator('#deliveredTime').innerText(), '—');
  await page.locator('[data-nav="profile"]').click();
  assert.equal(await page.locator('#vehicleSection').isVisible(), true);
  await logOut(page);
  await signIn(page, '+7 701 111 22 33');
  assert.equal(await page.locator('#roleLabel').innerText(), 'Перевозчик', 'local login restores the registered role');
  await page.locator('[data-nav="orders"]').click();
  await page.locator('[data-filter="completed"]').click();
  assert.equal(await page.locator('#ordersHeading').innerText(), 'Мои рейсы');
  assert.equal(await page.locator('.bottom-nav [aria-current="page"]').getAttribute('data-nav'), 'orders');
  assert.equal(await page.locator('#ordersList .order-item').count(), 1, 'delivered order remains in carrier history');

  await logOut(page);
  await register(page, { name: 'Александр Константинопольский Путешественников', phone: '+7 702 222 33 44', email: 'very.long.address.for.layout.checks@example.com', role: 'customer' });
  await page.locator('[data-nav="profile"]').click();
  assert.equal(await page.locator('#profileRole').innerText(), 'Заказчик');
  assert.equal(await page.locator('#vehicleSection').isVisible(), false);
  assert((await page.locator('#profileName').innerText()).length > 30);
  assert((await page.locator('#profileEmail').innerText()).includes('very.long.address'));
  await page.setViewportSize({ width: 320, height: 568 });
  await assertNoDocumentOverflow(page, 'long profile at 320x568');
  await page.addStyleTag({ content: 'html,body,*{font-family:Arial,system-ui,sans-serif!important}' });
  await assertNoDocumentOverflow(page, 'Arial fallback profile');
  await page.locator('[data-nav="home"]').click();
  assert((await page.locator('#homeHeading').innerText()).includes('Александр'));
  await page.locator('[data-nav="create"]').click();
  await page.locator('#origin').fill('Очень длинное название населённого пункта Северный район');
  await page.locator('#destination').fill('Другой удалённый логистический терминал');
  await page.locator('#amount').fill('15000');
  await page.locator('#createForm button[type="submit"]').click();
  await page.locator('[data-filter="waiting"]').click();
  const longOrder = page.locator('#ordersList .order-item').first();
  const longId = await longOrder.getAttribute('data-order-id');
  await longOrder.click();
  assert.equal(await page.locator('#detailHeading').innerText(), `Заказ ${longId}`);
  assert.equal(await page.locator('#mapLink').isVisible(), false, 'unknown coordinates must not create a 2GIS link');
  assert((await page.locator('#mapNotice').innerText()).includes('не заданы'));
  await assertNoDocumentOverflow(page, 'long route at 320x568');

  for (const size of [
    [320, 568], [360, 800], [390, 844], [412, 915], [440, 956], [568, 320], [844, 390]
  ]) {
    await page.setViewportSize({ width: size[0], height: size[1] });
    await assertNoDocumentOverflow(page, `${size[0]}x${size[1]}`);
  }

  const cdp = await context.newCDPSession(page);
  let safeAreaSupported = true;
  try {
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, right: 47, bottom: 21, left: 47 } });
  } catch (error) {
    if (!/wasn't found|not found|not supported/i.test(error.message)) throw error;
    safeAreaSupported = false;
    console.log(`Safe-area CDP override unavailable: ${error.message}`);
  }
  await page.setViewportSize({ width: 568, height: 320 });
  const landscape = await page.evaluate(() => ({ content: document.querySelector('#detailScreen').clientHeight, top: document.querySelector('.topbar').getBoundingClientRect().height, nav: document.querySelector('.bottom-nav').getBoundingClientRect().height }));
  assert(landscape.content >= 160, `landscape needs at least 160px screen area: ${JSON.stringify(landscape)}`);
  if (safeAreaSupported) {
    const insets = await page.evaluate(() => {
      const probe = document.createElement('div'); probe.style.cssText = 'position:fixed;inset:0 auto auto 0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right)'; document.body.append(probe);
      const computed = getComputedStyle(probe); const value = { top: parseFloat(computed.paddingTop), bottom: parseFloat(computed.paddingBottom), left: parseFloat(computed.paddingLeft), right: parseFloat(computed.paddingRight) }; probe.remove();
      const navBottom = Math.max(...[...document.querySelectorAll('.nav-btn')].map(button => button.getBoundingClientRect().bottom));
      return { ...value, navBottom, height: innerHeight };
    });
    assert.equal(insets.top, 47); assert.equal(insets.bottom, 21); assert.equal(insets.left, 47); assert.equal(insets.right, 47);
    assert(insets.navBottom <= insets.height - insets.bottom + 1, `bottom nav overlaps safe area: ${JSON.stringify(insets)}`);
  }
  await assertNoDocumentOverflow(page, 'landscape safe area');
  await page.locator('[data-nav="profile"]').click();
  await page.locator('#openProfilePhotos').click();
  const photoBounds = await page.evaluate(() => {
    const image = document.querySelector('#viewerImage').getBoundingClientRect();
    const stage = document.querySelector('#viewerStage').getBoundingClientRect();
    return { top: image.top, bottom: image.bottom, stageTop: stage.top, stageBottom: stage.bottom };
  });
  assert(photoBounds.top >= photoBounds.stageTop && photoBounds.bottom <= photoBounds.stageBottom, `landscape photo overflow: ${JSON.stringify(photoBounds)}`);
  await screenshot(page, 'photos-landscape-safe-area.png');
  await page.keyboard.press('Escape');
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom: 0, left: 0, right: 0 } });
  await page.setViewportSize({ width: 390, height: 844 });
  await logOut(page);
  await signIn(page);
  await page.locator('[data-nav="orders"]').click();
  await page.locator('[data-filter="waiting"]').click();
  assert.equal(await page.locator(`[data-order-id="${longId}"]`).count(), 0, 'seed login must not take another customer order');
  await logOut(page);
  await signIn(page, '+7 702 222 33 44');
  await page.locator('[data-nav="orders"]').click();
  await page.locator('[data-filter="waiting"]').click();
  assert.equal(await page.locator(`[data-order-id="${longId}"]`).count(), 1, 'the original customer keeps their order after seed login');

  assert.deepEqual(errors, [], `browser errors: ${errors.join(' | ')}`);
  assert.deepEqual(externalRequests, [], `unexpected external requests before manual 2GIS navigation: ${externalRequests.join(', ')}`);
  console.log(`PASS: local auth, role registration/login, order filters and periods, validation, KZT/USD publishing, status timestamps, photos/documents, file:// routing, viewport overflow, safe area${safeAreaSupported ? '' : ' (CDP override unavailable)'}.`);
  console.log(`Screenshots: ${output}`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
