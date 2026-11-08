"""Visual enhancements are optional and cannot mutate the certificate workflow."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright, expect

URL = 'http://127.0.0.1:8950'
out = Path('/tmp/gto-frontend-design'); out.mkdir(exist_ok=True)
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'))
    page = browser.new_page(viewport={'width':1440,'height':1000})
    errors = []; page.on('pageerror',lambda e:errors.append(str(e)))
    page.goto(URL,wait_until='networkidle')
    page.evaluate('document.fonts.ready')
    expect(page.locator('#hero-canvas canvas')).to_have_count(1,timeout=15000)
    snapshot = '''() => JSON.stringify({
      storage:Object.fromEntries(Object.entries(localStorage).sort()),
      fields:[...document.querySelectorAll('#form input')].map(e=>[e.id,e.value]),
      geometry:[...document.querySelectorAll('#pageOperator .field')].map(e=>[e.textContent,e.style.cssText])
    })'''
    before = page.evaluate(snapshot)
    toggle = page.locator('#alignment-toggle')
    expect(toggle).to_have_attribute('aria-pressed','false')
    toggle.focus();page.keyboard.press('Enter')
    expect(toggle).to_have_attribute('aria-pressed','true')
    expect(page.locator('#alignment-demo')).to_have_class('alignment-demo is-aligned')
    page.wait_for_timeout(650)
    assert page.locator('.demo-word').evaluate_all('(nodes)=>nodes.every(e=>getComputedStyle(e).translate.split(" ").every(v=>parseFloat(v)===0))')
    toggle.click();expect(toggle).to_have_attribute('aria-pressed','false')
    assert page.evaluate(snapshot)==before,'Demonstration changed participant data or print positions'
    control=page.locator('#scene-motion')
    control.click();expect(control).to_have_attribute('aria-pressed','false')
    expect(page.locator('#hero-canvas canvas')).to_have_count(0)
    expect(page.locator('.scene-fallback')).to_have_css('opacity','1')
    control.click();expect(page.locator('#hero-canvas canvas')).to_have_count(1)
    expect(control).to_have_attribute('aria-pressed','true')
    assert page.evaluate(snapshot)==before,'3D control changed workflow state'
    print('PASS: keyboard/touch-ready demo and 3D pause/resume leave participants, calibration and storage unchanged')
    page.emulate_media(reduced_motion='reduce')
    expect(control).to_be_hidden();expect(page.locator('#hero-canvas canvas')).to_have_count(0)
    expect(page.locator('.hero-art')).to_have_css('animation-name','none')
    expect(page.locator('.demo-word').first).to_have_css('transition-duration','0s')
    toggle.click();expect(toggle).to_have_attribute('aria-pressed','true')
    page.evaluate('scrollTo(0,0)');page.screenshot(path=str(out/'desktop.png'),full_page=True)
    page.locator('.primary-cta').click();expect(page.locator('#workspace-title')).to_be_focused()
    expect(page.locator('#benefits')).to_be_hidden()
    expect(page.locator('#work-panel')).to_be_visible()
    print('PASS: reduced motion stops both WebGL and CSS motion; editor CTA hides marketing content')
    mobile=browser.new_context(viewport={'width':375,'height':900},is_mobile=True,has_touch=True,reduced_motion='reduce')
    phone=mobile.new_page();phone.goto(URL,wait_until='networkidle');phone.evaluate('document.fonts.ready')
    phone.locator('#alignment-toggle').tap();expect(phone.locator('#alignment-toggle')).to_have_attribute('aria-pressed','true')
    assert phone.locator('#field-surname').evaluate('(e)=>parseFloat(getComputedStyle(e).fontSize)')>=16
    assert phone.evaluate('document.documentElement.scrollWidth<=innerWidth')
    phone.screenshot(path=str(out/'mobile.png'),full_page=True)
    mobile.close()
    static=browser.new_context(java_script_enabled=False,viewport={'width':375,'height':900})
    fallback=static.new_page();fallback.goto(URL,wait_until='networkidle')
    expect(fallback.locator('#hero-title')).to_be_visible()
    expect(fallback.locator('#alignment-toggle')).to_be_hidden()
    expect(fallback.locator('#scene-motion')).to_be_hidden()
    expect(fallback.locator('#alignment-demo')).to_have_class('alignment-demo is-aligned')
    static.close()
    assert not errors,errors
    print('PASS: touch input, readable mobile fields and static illustration when enhancements are unavailable')
    browser.close()
