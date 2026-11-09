"""Local scan must never print or persist; calibration ruler must use true mm."""
import base64,os,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
OUT=Path('/tmp/gto-calibration');OUT.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'))
 page=b.new_page(viewport={'width':1440,'height':1100},reduced_motion='reduce')
 errors=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append((r.method,r.url)))
 page.goto('http://127.0.0.1:8950',wait_until='networkidle');page.locator('#blank-silver').check();page.locator('#tabAdmin').click()
 page.locator('.calibration-checks > summary').click()
 image=page.evaluate('''() => {const c=document.createElement('canvas');c.width=1400;c.height=950;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,1400,950);x.strokeStyle='#222';for(const y of [360,413,466]){x.beginPath();x.moveTo(780,y);x.lineTo(1330,y);x.stroke();}return c.toDataURL('image/png').split(',')[1]}''')
 scan={'name':'blank.png','mimeType':'image/png','buffer':base64.b64decode(image)}
 before=page.locator('#page [data-key=surname]').evaluate('(e)=>e.style.cssText')
 page.locator('#blankReference').set_input_files(scan)
 expect(page.locator('#referenceStatus')).to_contain_text('blank.png')
 expect(page.locator('.blank-reference-image')).to_have_count(2)
 expect(page.locator('#page .otherlabel')).to_be_hidden()
 assert page.locator('#page [data-key=surname]').evaluate('(e)=>e.style.cssText')==before
 page.locator('#referenceOpacity').fill('90');page.locator('#referenceOpacity').dispatch_event('input')
 expect(page.locator('#page .blank-reference-image')).to_have_css('opacity','0.9')
 page.locator('#blank-bronze').check();expect(page.locator('.blank-reference-image')).to_have_count(0)
 page.locator('#blank-silver').check();expect(page.locator('.blank-reference-image')).to_have_count(2)
 # Print never includes the scan, even while it is visible in both previews.
 page.evaluate('window.print=()=>{}');page.locator('#tabWork').click();page.locator('#printOne').click()
 expect(page.locator('#print-root img')).to_have_count(0)
 expect(page.locator('#print-root .field')).to_have_count(11)
 page.locator('#tabAdmin').click();page.locator('#printCalibration').click()
 expect(page.locator('#print-root [data-calibration]')).to_have_count(1)
 expect(page.locator('#print-root .field')).to_have_count(0)
 page.emulate_media(media='print')
 line=page.locator('#print-root svg > g > path').first.evaluate('(e)=>({w:e.getBBox().width,h:e.getBBox().height,scale:e.getScreenCTM().a})')
 assert abs(line['w']*line['scale']-100*96/25.4)<.1 and abs(line['h']*line['scale']-60*96/25.4)<.1,line
 pdf=page.pdf(prefer_css_page_size=True);(OUT/'control-sheet.pdf').write_bytes(pdf)
 size=re.search(rb'/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)',pdf)
 assert size and abs(float(size[1])-140*72/25.4)<1 and abs(float(size[2])-95*72/25.4)<1
 assert len(re.findall(rb'/Type /Page\b',pdf))==1
 page.screenshot(path=str(OUT/'control-sheet.png'))
 page.emulate_media(media='screen');page.evaluate('dispatchEvent(new Event("afterprint"))')
 expect(page.locator('#print-root')).to_be_empty()
 assert not any(method!='GET' for method,url in requests),requests
 assert 'blob:' not in page.evaluate('JSON.stringify(localStorage)')
 print('PASS: per-type in-memory scans, opacity, no state mutation, no upload/persistence, no scan in printing')
 print('PASS: diagnostic rulers 100 × 60 mm, one 140 × 95 mm PDF page, no participants, print root cleared')
 page.reload(wait_until='networkidle');expect(page.locator('.blank-reference-image')).to_have_count(0)
 page.locator('#tabAdmin').click();page.locator('.calibration-checks > summary').click()
 bad=page.evaluate('''()=>{const c=document.createElement('canvas');c.width=100;c.height=100;return c.toDataURL('image/png').split(',')[1]}''')
 page.locator('#blankReference').set_input_files({'name':'square.png','mimeType':'image/png','buffer':base64.b64decode(bad)})
 expect(page.locator('#feedback')).to_contain_text('Обрежьте скан');expect(page.locator('.blank-reference-image')).to_have_count(0)
 page.locator('#blankReference').set_input_files(scan);expect(page.locator('.blank-reference-image')).to_have_count(2)
 page.locator('#removeReference').click();expect(page.locator('.blank-reference-image')).to_have_count(0);expect(page.locator('#page .otherlabel')).to_be_visible()
 assert not errors,errors
 print('PASS: reload clears scan; incorrect proportions rejected; removal restores schematic reference')
 b.close()
