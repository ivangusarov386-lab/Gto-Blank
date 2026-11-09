"""Correct physical size and isolated gold/silver/bronze print workflows."""
import json,os,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
OUT=Path('/tmp/gto-blank-types');OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'))
 page=b.new_page(viewport={'width':1440,'height':1100},reduced_motion='reduce')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.goto('http://127.0.0.1:8950',wait_until='networkidle')
 # A real legacy configuration must retain its millimetres despite the corrected paper size.
 page.evaluate('''() => {const c={fields:Object.fromEntries([...document.querySelectorAll('#page .field')].map(e=>[e.dataset.key,{x:parseFloat(e.style.left),y:parseFloat(e.style.top),size:parseFloat(e.style.fontSize)}])),offset:{dx:0,dy:0}};c.fields.surname.x=81.2;localStorage.setItem('gto-print-config',JSON.stringify(c));}''')
 page.reload(wait_until='networkidle');expect(page.locator('#blank-gold')).to_be_checked()
 assert page.locator('#pageOperator .field').nth(1).evaluate('(e)=>parseFloat(e.style.left)')==81.2
 page.evaluate('window.print=()=>{}')
 for kind,award,count in [('gold','ЗОЛОТЫМ',8),('silver','СЕРЕБРЯНЫМ',11),('bronze','БРОНЗОВЫМ',11)]:
  page.locator('#blank-'+kind).check()
  expect(page.locator('#form input')).to_have_count(count)
  expect(page.locator('#pageOperator .otherlabel')).to_contain_text(award)
  assert page.locator('#pageOperator').evaluate('(e)=>Math.abs(parseFloat(getComputedStyle(e).width)-140*96/25.4)<.02&&Math.abs(parseFloat(getComputedStyle(e).height)-95*96/25.4)<.02')
  if kind!='gold':
   expect(page.locator('#pageOperator .authority-reference')).to_be_visible()
   expect(page.locator('#pageOperator .minister-label')).to_have_text('(должность)')
   page.locator('#field-authority').fill('Учебный орган спорта')
   page.locator('#field-signerPosition').fill('Руководитель')
   page.locator('#field-signerName').fill('Примеров И. И.')
  page.locator('#printOne').click()
  expect(page.locator('#print-root .field')).to_have_count(count)
  expect(page.locator('#print-root .otherlabel')).to_have_count(0)
  expect(page.locator('#print-root .authority-reference')).to_have_count(0)
  if kind!='gold':expect(page.locator('#print-root')).to_contain_text('Учебный орган спорта')
  pdf=page.pdf(prefer_css_page_size=True);(OUT/(kind+'.pdf')).write_bytes(pdf)
  box=re.search(rb'/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)',pdf)
  assert box and abs(float(box[1])-140*72/25.4)<1 and abs(float(box[2])-95*72/25.4)<1
  page.evaluate('dispatchEvent(new Event("afterprint"))')
  page.locator('#tabAdmin').click()
  page.locator('#dx').fill({'gold':'1.1','silver':'2.2','bronze':'3.3'}[kind])
  if not page.locator('.fine-settings').evaluate('(e)=>e.open'):page.locator('.fine-settings > summary').click()
  page.locator('#positions input[data-key="surname"][data-prop="x"]').fill({'gold':'81.2','silver':'83','bronze':'85'}[kind])
  page.locator('#profileName').fill('Профиль '+kind);page.locator('#saveProfile').click()
  page.locator('#tabWork').click()
  page.locator('#operator-preview').screenshot(path=str(OUT/(kind+'.png')))
 print('PASS: three references and field sets; 140 × 95 mm PDFs print only variable text; legacy gold coordinates retained')
 for kind,dx in [('silver','2.2'),('gold','1.1'),('bronze','3.3')]:
  page.locator('#blank-'+kind).check();page.locator('#tabAdmin').click()
  expect(page.locator('#dx')).to_have_value(dx);expect(page.locator('#profileName')).to_have_value('Профиль '+kind)
  expect(page.locator('#positions input[data-key="surname"][data-prop="x"]').first).to_have_value({'gold':'81.2','silver':'83','bronze':'85'}[kind])
 page.reload(wait_until='networkidle');expect(page.locator('#blank-bronze')).to_be_checked();page.locator('#tabAdmin').click();expect(page.locator('#dx')).to_have_value('3.3')
 # Wrong-template backups must not silently apply to another form.
 data={'version':1,'template':'silver','profiles':[]}
 page.locator('#importProfiles').set_input_files({'name':'silver.json','mimeType':'application/json','buffer':json.dumps(data).encode()})
 expect(page.locator('#feedback')).to_contain_text('тип бланка');expect(page.locator('#dx')).to_have_value('3.3')
 print('PASS: separate offsets/profiles per type, selected type restored on reload, wrong-template backups rejected')
 page.locator('#dx').fill('0');page.locator('#tabWork').click()
 for width in [320,375,768,1440]:
  page.set_viewport_size({'width':width,'height':1000})
  for size in [16,32]:
   page.evaluate('(n)=>document.documentElement.style.fontSize=n+"px"',size)
   for kind in ['gold','silver','bronze']:
    page.locator('#blank-'+kind).check()
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,size,kind)
 page.evaluate('document.documentElement.style.fontSize=""')
 page.set_viewport_size({'width':375,'height':900});page.locator('#blank-silver').check();page.screenshot(path=str(OUT/'silver-mobile.png'),full_page=True)
 assert not errors,errors
 print('PASS: all three types reflow on mobile and 200% text without script errors')
 b.close()
