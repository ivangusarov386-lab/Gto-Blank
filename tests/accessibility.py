"""Rendered accessibility gates for work, calibration and import/print dialogs."""
import json,os,subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('/tmp/gto-ecc-validation');out.mkdir(exist_ok=True)
subprocess.run(['node','tests/make-excel-fixtures.mjs'],check=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'))
 page=b.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce')
 page.on('dialog',lambda d:d.accept())
 page.goto('http://127.0.0.1:8950',wait_until='networkidle')
 page.add_script_tag(path='node_modules/axe-core/axe.min.js')
 observations=[]
 def scan(name):
  result=page.evaluate('async()=>await axe.run(document,{runOnly:{type:"tag",values:["wcag2a","wcag2aa","wcag21aa"]}})')
  violations=[{'id':v['id'],'nodes':[n['target'] for n in v['nodes']]} for v in result['violations']]
  observations.append({'state':name,'violations':violations,'incompleteChecks':len(result['incomplete'])})
  assert not violations,(name,violations)
 scan('work-desktop')
 page.screenshot(path=str(out/'desktop.png'),full_page=True)
 page.locator('#tabAdmin').click();scan('calibration-desktop')
 page.set_viewport_size({'width':375,'height':900});scan('calibration-mobile')
 page.screenshot(path=str(out/'mobile.png'),full_page=True)
 page.locator('#tabWork').click()
 loaded=[]
 def observe_excel(route):
  loaded.append(page.locator('#file').is_disabled() and 'Загружаем' in page.locator('#feedback').inner_text())
  route.continue_()
 page.route('**/assets/excel.js*',observe_excel)
 page.locator('#file').set_input_files('/tmp/gto-fixture.xlsx')
 expect(page.locator('#import-dialog')).to_be_visible();assert loaded==[True],loaded
 scan('import-dialog')
 page.locator('#cancelImport').click()
 page.locator('#printAll').click();scan('print-review-dialog')
 page.locator('#cancelPrint').click()
 Path(out/'accessibility.json').write_text(json.dumps(observations,ensure_ascii=False,indent=2))
 print('PASS: 5 rendered states have no automatic axe WCAG A/AA violations; Excel loading feedback observed')
 b.close()
