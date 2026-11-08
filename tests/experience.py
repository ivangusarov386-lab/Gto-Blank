"""Landing page, progressive 3D and CTA acceptance checks (server on 8950)."""
import os
from playwright.sync_api import sync_playwright, expect

URL = 'http://127.0.0.1:8950'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'))
    page = browser.new_page(viewport={'width': 1440, 'height': 1080})
    errors, bad_responses = [], []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('response', lambda r: bad_responses.append((r.status, r.url)) if r.status >= 400 else None)
    page.goto(URL, wait_until='networkidle')
    expect(page.locator('.hero-art')).to_have_class('hero-art scene-ready', timeout=15000)
    expect(page.locator('#hero-canvas canvas')).to_have_count(1)
    assert page.locator('#hero-canvas canvas').evaluate('(c) => c.width > 0 && c.height > 0')
    page.mouse.move(1100, 350)
    page.wait_for_timeout(400)
    page.screenshot(path='/tmp/gto-premium-desktop.png', full_page=True)
    print('PASS: local WebGL scene initializes and renders, assets respond successfully')

    page.locator('#tabAdmin').click()
    page.locator('.header-cta').click()
    expect(page.locator('#tabWork')).to_have_attribute('aria-pressed','true')
    expect(page.locator('#studio')).to_be_focused()
    expect(page.locator('#work-panel')).to_be_visible()
    page.locator('.secondary-cta').click()
    expect(page.locator('#operator-preview')).to_be_focused()
    print('PASS: editor and example CTAs work from either mode')

    page.evaluate("document.querySelector('#hero-canvas canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext()")
    expect(page.locator('#hero-canvas canvas')).to_have_count(0)
    expect(page.locator('.scene-fallback')).to_have_css('opacity','1')
    expect(page.locator('#names .name')).to_have_count(3)
    page.emulate_media(reduced_motion='reduce')
    expect(page.locator('#hero-canvas canvas')).to_have_count(0)
    assert page.locator('.hero-art').evaluate('(e) => getComputedStyle(e).animationName') == 'none'
    print('PASS: context loss and reduced motion retain illustration and usable editor')

    for width in [320,375,768,1024,1440]:
        page.set_viewport_size({'width':width,'height':1000})
        for tab in ['tabWork','tabAdmin']:
            page.locator('#'+tab).click()
            page.wait_for_timeout(100)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width,tab)
    print('PASS: both modes fit 320/375/768/1024/1440px')

    mobile = browser.new_context(viewport={'width':375,'height':900},is_mobile=True,has_touch=True)
    phone = mobile.new_page()
    requests = []
    phone.on('request',lambda r:requests.append(r.url))
    phone.goto(URL,wait_until='networkidle')
    phone.wait_for_timeout(1800)
    assert not any('hero-3d.js' in r for r in requests)
    expect(phone.locator('.scene-fallback')).to_have_css('opacity','1')
    phone.screenshot(path='/tmp/gto-premium-mobile.png',full_page=True)
    mobile.close()
    print('PASS: mobile illustration is visible without downloading Three.js')

    fallback = browser.new_context(viewport={'width':1440,'height':1000})
    fallback.route('**/assets/hero-3d.js',lambda route:route.abort())
    offline = fallback.new_page()
    offline.goto(URL,wait_until='networkidle')
    offline.wait_for_timeout(1000)
    expect(offline.locator('.scene-fallback')).to_have_css('opacity','1')
    offline.locator('.primary-cta').click()
    expect(offline.locator('#studio')).to_be_focused()
    fallback.close()
    assert not errors, errors
    assert not bad_responses, bad_responses
    print('PASS: failed optional 3D download preserves content and primary action; no page errors')
    browser.close()
