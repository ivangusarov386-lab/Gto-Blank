"""Measured silver baselines and safe migration from the earlier schematic."""
import fitz,os
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
OUT=Path('/tmp/gto-silver-measured');OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'))
 page=b.new_page(viewport={'width':1440,'height':1100},reduced_motion='reduce')
 page.on('dialog',lambda d:d.accept())
 page.goto('http://127.0.0.1:8950',wait_until='networkidle');page.locator('#blank-silver').check();page.evaluate('window.print=()=>{}')
 page.locator('#printOne').click();expect(page.locator('#print-root .date-part')).to_have_count(6);pdf=page.pdf(prefer_css_page_size=True);(OUT/'silver.pdf').write_bytes(pdf)
 doc=fitz.open(stream=pdf,filetype='pdf');assert abs(doc[0].rect.width*25.4/72-140)<.2 and abs(doc[0].rect.height*25.4/72-95)<.2
 spans=[s for block in doc[0].get_text('dict')['blocks'] if 'lines' in block for line in block['lines'] for s in line['spans']]
 baselines={s['text']:s['origin'][1]*25.4/72 for s in spans}
 for text,line in [('ДЕМО001',28.7),('Миронова',34.7),('Полина',39.9),('Олеговна',45.1),('V',67.5),('12',73.25),('001 ПР',73.25),('20',89.9),('Департамент спорта города Москвы',17),('Руководитель',80.6),('Примеров И. И.',80.6)]:
  baseline=next(y for t,y in baselines.items() if t.startswith(text))
  assert 0<=line-baseline<=.5,(text,line,baseline)
 assert all('НАГРАЖДЕН' not in s['text'] for s in spans)
 assert '2026' not in doc[0].get_text()
 expect(page.locator('#pageOperator .date-part')).to_have_count(6)
 expect(page.locator('#field-orderDate')).to_have_value('12.03.2026')
 page.locator('#field-orderDate').fill('12.03.1999');page.locator('#printOne').click()
 expect(page.locator('#error-orderDate')).to_contain_text('2000')
 page.locator('#field-orderDate').fill('12.03.2026')
 page.locator('#operator-preview').screenshot(path=str(OUT/'preview.png'))
 print('PASS: actual PDF text baselines sit within 0.5 mm above measured silver ruling; page remains 140 × 95 mm')
 page.locator('#tabAdmin').click()
 date=page.locator('#page [data-key=orderDate]')
 positions=date.locator('.date-part').evaluate_all('(els)=>els.map(e=>e.getBoundingClientRect().left)')
 scale=page.locator('#page').bounding_box()['width']/140
 assert abs((positions[1]-positions[0])/scale-6.8)<.05
 assert abs((positions[2]-positions[0])/scale-22.9)<.05
 date.focus();date.press('ArrowRight')
 shifted=date.locator('.date-part').evaluate_all('(els)=>els.map(e=>e.getBoundingClientRect().left)')
 assert all(abs((after-before)/scale-.2)<.05 for before,after in zip(positions,shifted))
 page.locator('#undoCalibration').click()
 print('PASS: split date slots preserve spacing while keyboard movement and undo move the entire date')

 # Unmodified previous factory defaults migrate without dropping printer offsets.
 page.evaluate('''()=>{localStorage.setItem('gto-print-config-silver',JSON.stringify({fields:defaultFields('bronze'),offset:{dx:1.2,dy:-.3}}));}''')
 page.reload(wait_until='networkidle');page.locator('#tabAdmin').click()
 expect(page.locator('#dx')).to_have_value('1.2')
 assert page.locator('#page [data-key=number]').evaluate('(e)=>parseFloat(e.style.top)')==25.2
 assert page.evaluate('JSON.parse(localStorage.getItem("gto-print-config-silver")).layoutVersion')==2
 # A changed position must never migrate silently.
 page.evaluate('''()=>{const f=defaultFields('bronze');f.surname.x=88;localStorage.setItem('gto-print-config-silver',JSON.stringify({fields:f,offset:{dx:1.2,dy:-.3}}));}''')
 page.reload(wait_until='networkidle');page.locator('#tabAdmin').click()
 assert page.locator('#page [data-key=surname]').evaluate('(e)=>parseFloat(e.style.left)')==89.2
 assert page.locator('#page [data-key=number]').evaluate('(e)=>parseFloat(e.style.top)')==22.2
 page.locator('#profileName').fill('Мой прежний профиль');page.locator('#saveProfile').click()
 profiles=page.evaluate('localStorage.getItem("gto-printer-profiles-silver")')
 page.locator('#applyMeasuredLayout').click()
 assert page.locator('#page [data-key=number]').evaluate('(e)=>parseFloat(e.style.top)')==25.2
 assert page.locator('#page [data-key=surname]').evaluate('(e)=>parseFloat(e.style.left)')==80.2
 assert page.evaluate('localStorage.getItem("gto-printer-profiles-silver")')==profiles
 expect(page.locator('#dx')).to_have_value('1.2')
 page.locator('#undoCalibration').click()
 assert page.locator('#page [data-key=surname]').evaluate('(e)=>parseFloat(e.style.left)')==89.2
 assert page.locator('#page [data-key=number]').evaluate('(e)=>parseFloat(e.style.top)')==22.2
 page.locator('#blank-bronze').check();expect(page.locator('#applyMeasuredLayout')).to_be_hidden()
 assert page.locator('#page [data-key=number]').evaluate('(e)=>parseFloat(e.style.top)')==22.5
 print('PASS: untouched defaults migrate; custom positions, named profiles and offsets preserved; explicit application supports undo; bronze unchanged')
 b.close()
