"""Browser regression checks for dragging template fields. Start the local server on 8950."""
import json
import os
from playwright.sync_api import sync_playwright, expect

URL = 'http://127.0.0.1:8950'
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'))
    page = browser.new_page(viewport={'width': 1440, 'height': 1000})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(URL, wait_until='networkidle')
    page.locator('#tabAdmin').click()
    page.locator('#dx').fill('2.4')
    page.locator('#dy').fill('-1.2')

    def coords(key='surname'):
        return page.evaluate('(key) => JSON.parse(localStorage.getItem("gto-print-config")).fields[key]', key)

    def drag_by(dx, dy):
        field = page.locator('#page [data-key="surname"]')
        field.scroll_into_view_if_needed()
        box = field.bounding_box()
        frame = page.locator('#page').bounding_box()
        x, y = box['x'] + box['width'] * .2, box['y'] + box['height'] * .2
        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + dx * frame['width'] / 140, y + dy * frame['height'] / 95, steps=8)
        page.mouse.up()

    for width in [1440, 375]:
        page.set_viewport_size({'width': width, 'height': 1000})
        page.wait_for_timeout(200)
        before = coords()
        drag_by(6, 3)
        after = coords()
        assert abs(after['x'] - before['x'] - 6) <= .1, (width, before, after)
        assert abs(after['y'] - before['y'] - 3) <= .1
        page.reload(wait_until='networkidle')
        page.locator('#tabAdmin').click()
        assert coords() == after
    print('PASS: dragging at desktop/mobile scales with printer offsets, persistence')

    field = page.locator('#page [data-key="surname"]')
    field.focus()
    before = coords()
    field.press('ArrowRight')
    assert abs(coords()['x'] - before['x'] - .2) < .01
    field.press('Shift+ArrowDown')
    assert abs(coords()['y'] - before['y'] - 1) < .01
    before = coords()
    field.scroll_into_view_if_needed()
    box = field.bounding_box()
    page.mouse.move(box['x'] + 2, box['y'] + 2)
    page.mouse.down()
    page.mouse.move(box['x'] + 30, box['y'] + 20)
    page.keyboard.press('Escape')
    page.mouse.up()
    assert coords() == before
    print('PASS: keyboard fine adjustment and Escape cancellation')

    drag_by(-300, -300)
    position = page.locator('#page [data-key="surname"]').evaluate('(e) => ({x:parseFloat(e.style.left),y:parseFloat(e.style.top)})')
    assert position['x'] >= 0 and position['y'] >= 0
    drag_by(300, 300)
    frame = page.locator('#page').bounding_box()
    box = page.locator('#page [data-key="surname"]').bounding_box()
    assert box['x'] + box['width'] <= frame['x'] + frame['width'] + 1
    assert box['y'] + box['height'] <= frame['y'] + frame['height'] + 1
    print('PASS: field remains within the template')

    page.set_viewport_size({'width': 1440, 'height': 1000})
    page.reload(wait_until='networkidle')
    page.locator('#tabAdmin').click()
    page.locator('#reset').click()
    field = page.locator('#page [data-key="surname"]')
    field.scroll_into_view_if_needed()
    before = coords()
    box, frame = field.bounding_box(), page.locator('#page').bounding_box()
    client = page.context.new_cdp_session(page)
    x, y = box['x'] + 2, box['y'] + 2
    client.send('Input.dispatchTouchEvent', {'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    client.send('Input.dispatchTouchEvent', {'type':'touchMove','touchPoints':[{'x':x+frame['width']*5/140,'y':y+frame['height']*2/95}]})
    client.send('Input.dispatchTouchEvent', {'type':'touchEnd','touchPoints':[]})
    assert abs(coords()['x'] - before['x'] - 5) <= .1
    assert abs(coords()['y'] - before['y'] - 2) <= .1
    print('PASS: real touch input')

    page.locator('#tabWork').click()
    page.evaluate('window.print = () => {}')
    page.locator('#printOne').click()
    printed = page.locator('#print-root .field').nth(1)
    assert printed.evaluate('(e) => parseFloat(e.style.left)') == coords()['x']
    expect(page.locator('#print-root [tabindex]')).to_have_count(0)
    expect(page.locator('#pageOperator .movable')).to_have_count(0)
    assert not errors, errors
    print('PASS: printed coordinates match dragging; editing controls limited to template')
    browser.close()
