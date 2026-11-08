"""Certificate reference wording, collisions and unchanged print coordinates."""
import json
import os
from playwright.sync_api import sync_playwright, expect

WORDING = [
    'НАГРАЖДЕН(А)', 'ЗОЛОТЫМ ЗНАКОМ ОТЛИЧИЯ', 'ВСЕРОССИЙСКОГО',
    'ФИЗКУЛЬТУРНО-СПОРТИВНОГО', 'КОМПЛЕКСА', '«ГОТОВ К ТРУДУ И ОБОРОНЕ» (ГТО)',
]
with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH', '/usr/bin/chromium'))
    page = browser.new_page(viewport={'width':1440,'height':1000}, reduced_motion='reduce')
    # A stale unversioned stylesheet must never be requested by the current HTML.
    stale_requests = []
    def old_css(route):
        stale_requests.append(route.request.url)
        route.fulfill(body='.page {position:relative}', content_type='text/css')
    page.route('**/assets/styles.css', old_css)
    page.goto('http://127.0.0.1:8950',wait_until='networkidle')
    assert not stale_requests

    for root in ['#pageOperator','#page']:
        assert page.locator(root+' .otherlabel span').all_text_contents() == WORDING
        for selector, text in [('.step-label','СТУПЕНИ'),('.minister-label','Министр спорта'),('.minister-name','М.В. Дегтярев'),('.order-suffix','г. №'),('.seal-label','М.П.'),('.issued-suffix','г.')]:
            expect(page.locator(root+' '+selector)).to_have_text(text)

    # At the default calibration, the full printed wording stays between the name and level.
    page.locator('#tabAdmin').click()
    def box(selector):
        return page.locator('#page '+selector).bounding_box()
    middle, award, level, label = [box(s) for s in ['[data-key="middle"]','.otherlabel','[data-key="level"]','.step-label']]
    assert middle['y'] + middle['height'] < award['y']
    assert award['y'] + award['height'] < level['y']
    assert level['x'] + level['width'] < label['x']
    expect(page.locator('#page .step-label')).to_have_css('position','absolute')
    rows = page.locator('#page .otherlabel span').evaluate_all('(els)=>els.map(e=>({y:e.getBoundingClientRect().top,height:e.getBoundingClientRect().height,display:getComputedStyle(e).display}))')
    assert all(row['display']=='block' for row in rows)
    assert all(rows[i+1]['y'] >= rows[i]['y']+rows[i]['height']-.1 for i in range(len(rows)-1))
    for width in [375,1440]:
        page.set_viewport_size({'width':width,'height':1000})
        page.wait_for_timeout(150)
        bounds=page.locator('#page').bounding_box()
        for selector in ['.otherlabel','.step-label','.minister-label','.minister-name','.order-suffix','.issued-suffix']:
            position=box(selector)
            assert position['x'] >= bounds['x'] and position['y'] >= bounds['y']
            assert position['x']+position['width'] <= bounds['x']+bounds['width']+.5
            assert position['y']+position['height'] <= bounds['y']+bounds['height']+.5
    page.set_viewport_size({'width':1440,'height':1000})
    page.wait_for_timeout(150)
    page.locator('#page').screenshot(path='/tmp/gto-corrected-template.png')
    print('PASS: complete six-line wording in both views; no default name/award/level collision')

    saved = {'fields':{'surname':{'x':82.3,'y':34.7,'size':12},'level':{'x':90.5,'y':68.2,'size':10}},'offset':{'dx':1.2,'dy':-.4}}
    page.evaluate('(config) => localStorage.setItem("gto-print-config", JSON.stringify(config))',saved)
    page.reload(wait_until='networkidle')
    assert json.loads(page.evaluate('localStorage.getItem("gto-print-config")')) == saved
    page.locator('#tabAdmin').click()
    expect(page.locator('#page [data-key="surname"]')).to_have_css('font-size','16px')
    page.locator('#tabWork').click()
    before = page.locator('#pageOperator .field').evaluate_all('(els)=>els.map(e=>[e.textContent,e.style.left,e.style.top,e.style.fontSize])')
    page.evaluate('window.print=()=>{}')
    page.locator('#printOne').click()
    printed = page.locator('#print-root .field').evaluate_all('(els)=>els.map(e=>[e.textContent,e.style.left,e.style.top,e.style.fontSize])')
    assert before == printed and len(printed)==8
    expect(page.locator('#print-root .otherlabel')).to_have_count(0)
    expect(page.locator('#print-root .step-label')).to_have_count(0)
    expect(page.locator('#print-root .minister-name')).to_have_count(0)
    assert not any('НАГРАЖДЕН' in row[0] or 'СТУПЕНИ' in row[0] for row in printed)
    print('PASS: existing calibration preserved; preview and print coordinates identical; reference text never prints')
    browser.close()
