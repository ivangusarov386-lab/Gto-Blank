"""End-to-end acceptance for ECC audit improvements. Local server: 8950."""
import json,os,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
BASE='http://127.0.0.1:8950'
subprocess.run(['node','tests/make-excel-fixtures.mjs'],check=True)
HEAD='Номер удостоверения;Фамилия;Имя;Отчество;Ступень;Дата приказа;Номер приказа;Дата выдачи\n'
VALID='НОМ001;Иванов;Иван;;V;16.07.2025;153 НГ;24.06.2026\n'
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'))
 page=b.new_page(viewport={'width':1440,'height':1100},reduced_motion='reduce')
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.goto(BASE,wait_until='networkidle');page.evaluate('() => {window.printCount=0;window.print=()=>{window.printCount+=1}}')
 # Compare rendered geometry, not just CSS coordinate strings.
 for width in [375,1440]:
  page.set_viewport_size({'width':width,'height':1100});page.wait_for_timeout(150)
  preview=page.locator('#pageOperator').evaluate('(e)=>{const r=e.getBoundingClientRect(),f=e.querySelectorAll(".field")[1].getBoundingClientRect(),s=new DOMMatrix(getComputedStyle(e).transform).a;return {x:(f.left-r.left)/s,y:(f.top-r.top)/s}}')
  page.locator('#printOne').click();page.emulate_media(media='print')
  printed=page.locator('.print-sheet').evaluate('(e)=>{const r=e.getBoundingClientRect(),f=e.children[1].getBoundingClientRect();return {x:f.left-r.left,y:f.top-r.top}}')
  for axis in ['x','y']:assert abs(preview[axis]-printed[axis])<.02,(width,axis,preview,printed)
  page.emulate_media(media='screen')
 page.evaluate('window.dispatchEvent(new Event("afterprint"));window.printCount=0')
 expect(page.locator('#print-root .print-sheet')).to_have_count(0)
 print('PASS: preview/print geometry matches within .02px at mobile and desktop scales; printed data cleared')
 def upload(text,encoding='utf-8',apply=True):
  page.locator('#file').set_input_files({'name':'participants.csv','mimeType':'text/csv','buffer':text.encode(encoding)})
  expect(page.locator('#import-dialog')).to_be_visible()
  if apply:page.locator('#applyImport').click()
 upload('Номер удостоверения;Приказ месяц;Приказ год\n123;7;2025\n')
 expect(page.locator('#field-orderDate')).to_have_value('??.07.2025')
 page.locator('#printOne').click();assert page.evaluate('window.printCount||0')==0
 expect(page.locator('#field-first')).to_have_attribute('aria-invalid','true')
 upload(HEAD+VALID+'НОМ002;Петров;;;V;31.02.2025;153;24.06.2026\n')
 expect(page.locator('#validation')).to_contain_text('1 из 2')
 page.locator('#printAll').click();expect(page.locator('#confirmPrint')).to_have_text('Напечатать только готовые (1)');page.locator('#confirmPrint').click()
 assert page.evaluate('window.printCount')==1;expect(page.locator('#print-root .print-sheet')).to_have_count(1)
 upload(HEAD+VALID+VALID)
 expect(page.locator('#error-number')).to_contain_text('повторяется')
 print('PASS: partial/impossible dates, required fields, duplicate checks and explicit ready-only batch printing')

 upload(HEAD+VALID)
 page.locator('#field-surname').fill('Длиннаяфамилия'*3)
 expect(page.locator('#error-surname')).to_contain_text('выходит за бланк')
 before=page.evaluate('window.printCount');page.locator('#printOne').click();assert page.evaluate('window.printCount')==before
 page.locator('#tabAdmin').click();page.locator('#fieldSelect').select_option('surname');page.locator('#fitField').click()
 expect(page.locator('#page .overflow-field')).to_have_count(0)
 page.locator('#undoCalibration').click();expect(page.locator('#page .overflow-field')).to_have_count(1)
 page.locator('#redoCalibration').click();expect(page.locator('#page .overflow-field')).to_have_count(0)
 print('PASS: long text blocks printing; field-only fitting supports undo/redo')

 page.locator('#reset').click();page.locator('#dx').fill('1.2');page.locator('#profileName').fill('Принтер А');page.locator('#saveProfile').click()
 page.locator('#dx').fill('4.4');page.locator('#profileName').fill('Принтер Б');page.locator('#saveProfile').click()
 page.locator('#profileSelect').select_option(label='Принтер А');expect(page.locator('#dx')).to_have_value('1.2')
 page.locator('#reset').click();expect(page.locator('#dx')).to_have_value('0');page.locator('#undoCalibration').click();expect(page.locator('#dx')).to_have_value('1.2')
 with page.expect_download() as d:page.locator('#exportProfiles').click()
 backup='/tmp/gto-printer-backup.json';d.value.save_as(backup);payload=json.load(open(backup));assert any(v['name']=='Принтер А' and v['offset']['dx']==1.2 for v in payload['profiles'])
 count=page.locator('#profileSelect option').count();page.locator('#importProfiles').set_input_files(backup);expect(page.locator('#profileSelect option')).to_have_count(count+len(payload['profiles']))
 print('PASS: independent printer profiles, confirmed reset, undo and backup round trip')

 page.locator('#tabWork').click();upload(HEAD+VALID)
 assert page.evaluate('localStorage.getItem("gto-participant-draft")') is None
 page.locator('#field-surname').fill('Сохранённая');page.locator('#keepDraft').check()
 assert 'Сохранённая' in page.evaluate('localStorage.getItem("gto-participant-draft")')
 page.reload(wait_until='networkidle');expect(page.locator('#field-surname')).to_have_value('Сохранённая')
 page.locator('#field-surname').fill('Изменённая');page.locator('#undoPeople').click();expect(page.locator('#field-surname')).to_have_value('Сохранённая')
 with page.expect_download() as d:page.locator('#exportPeople').click()
 csvpath='/tmp/gto-people-export.csv';d.value.save_as(csvpath);assert 'Сохранённая' in Path(csvpath).read_text(encoding='utf-8-sig')
 page.locator('#clearPeople').click();expect(page.locator('#names .name')).to_have_count(0);assert page.evaluate('localStorage.getItem("gto-participant-draft")') is None
 page.locator('#file').set_input_files(csvpath);page.locator('#applyImport').click();expect(page.locator('#field-surname')).to_have_value('Сохранённая')
 print('PASS: no default PII persistence, opt-in draft restoration, undo, full CSV export/import and deletion')

 page.evaluate('localStorage.setItem("gto-participant-draft",JSON.stringify({version:1,expiresAt:Date.now()-1,people:[{surname:"Просроченный"}]}))')
 page.reload(wait_until='networkidle');expect(page.locator('#field-surname')).to_have_value('Абакумова');assert page.evaluate('localStorage.getItem("gto-participant-draft")') is None
 page.locator('#tabAdmin').click();count=page.locator('#profileSelect option').count()
 page.locator('#importProfiles').set_input_files({'name':'invalid.json','mimeType':'application/json','buffer':b'{"version":1,"profiles":[{"name":"bad","fields":{},"offset":{}}]}'})
 expect(page.locator('#profileSelect option')).to_have_count(count);expect(page.locator('#feedback')).to_contain_text('Некорректная калибровка')
 page.locator('#tabWork').click()
 print('PASS: expired personal drafts are removed and invalid calibration backups do not change profiles')
 upload(HEAD+VALID.replace('Иванов','Петров'),'cp1251',apply=False)
 expect(page.locator('#import-table')).to_contain_text('Петров');page.locator('#cancelImport').click()
 upload('Сертификат;Участник;Имя;Ступень;Дата приказа;Номер приказа;Дата выдачи\n'+ '123;Кузнецов;Кузьма;IV;16.07.2025;153;24.06.2026\n',apply=False)
 page.locator('#map-number').select_option('0');page.locator('#map-surname').select_option('1');page.locator('#applyImport').click();expect(page.locator('#field-surname')).to_have_value('Кузнецов')
 print('PASS: Windows-1251 auto detection and custom column matching')

 # Offline here means all remote destinations are denied; local Excel chunk must suffice.
 page.route('https://**/*',lambda route:route.abort())
 for ext in ['xlsx','xls']:
  page.locator('#file').set_input_files('/tmp/gto-fixture.'+ext)
  expect(page.locator('#import-dialog')).to_be_visible();page.locator('#applyImport').click()
  expect(page.locator('#field-number')).to_have_value('ЭКС001');expect(page.locator('#field-orderDate')).to_have_value('16.07.2025')
  expect(page.locator('#validation')).to_contain_text('1 из 1')
 print('PASS: real XLSX and BIFF8 XLS imports work without remote CDN')
 for zone in ['Europe/Moscow','America/New_York']:
  context=b.new_context(timezone_id=zone,reduced_motion='reduce');z=context.new_page();z.on('dialog',lambda d:d.accept());z.goto(BASE,wait_until='networkidle');z.locator('#file').set_input_files('/tmp/gto-fixture.xlsx');z.locator('#applyImport').click();expect(z.locator('#field-orderDate')).to_have_value('16.07.2025');context.close()
 print('PASS: Excel calendar dates remain identical in positive and negative time zones')


 page.locator('#exportPeople').click();page.goto(BASE+'?editor=1#studio',wait_until='networkidle')
 expect(page.locator('.workspace-heading')).to_be_hidden();expect(page.locator('#work-panel')).to_be_visible()
 for width in [320,375,768,1440]:
  page.set_viewport_size({'width':width,'height':1100});page.locator('#tabAdmin').click();page.wait_for_timeout(150)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),width
  for selector in ['[data-nudge="1,0"]','#zoomEditor']:
   box=page.locator(selector).bounding_box();assert box['height']>=44 and box['width']>=44,(selector,box)
  page.locator('#zoomEditor').click();assert page.locator('#calibration-preview').evaluate('(e)=>e.scrollWidth>e.clientWidth') or width==1440
  page.locator('#zoomEditor').click()
 page.locator('#fieldSelect').select_option('surname');old=page.locator('#positions [data-key="surname"][data-prop="x"]').input_value()
 page.locator('[data-nudge="1,0"]').click();assert float(page.locator('#positions [data-key="surname"][data-prop="x"]').input_value())>float(old)
 page.screenshot(path='/tmp/gto-operations-desktop.png',full_page=True)
 page.set_viewport_size({'width':375,'height':1000});page.screenshot(path='/tmp/gto-operations-mobile.png',full_page=True)
 assert not errors,errors
 print('PASS: direct editor, responsive zoom, accessible nudge controls and no page errors')
 b.close()
