"""Frontend Design + Modern Web Guidance acceptance for version2."""
import json,os,re
from pathlib import Path
from playwright.sync_api import sync_playwright,expect
out=Path('/tmp/gto-version2');out.mkdir(exist_ok=True)
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'))
 page=b.new_page(viewport={'width':1440,'height':1000},reduced_motion='reduce')
 errors=[];failed=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('response',lambda r:failed.append([r.status,r.url]) if r.status>=400 else None)
 page.goto('http://127.0.0.1:8950',wait_until='networkidle');page.evaluate('document.fonts.ready')
 assert page.evaluate('document.fonts.check("16px Golos", "Сервис")')
 assert page.locator('link[rel=stylesheet]').count()==1
 assert page.locator('#golos-preload').get_attribute('crossorigin') is not None
 assert page.locator('#golos-preload').get_attribute('href').endswith('.woff2')
 expect(page.locator('#hero-title')).to_have_text('Сервис печати удостоверений ГТО')
 expect(page.get_by_role('search')).to_have_count(1)
 expect(page.locator('h1:visible')).to_have_count(1)
 page.screenshot(path=str(out/'desktop.png'),full_page=True)
 print('PASS: original requested title retained; local Golos font, one bundled stylesheet and semantic search')
 page.locator('.primary-cta').click()
 expect(page.locator('#workspace-title')).to_be_focused();expect(page.locator('h1:visible')).to_have_count(1)
 assert page.locator('#workspace-title').evaluate('(e)=>e.tagName')=='H1'
 assert 'Редактор' in page.title()
 page.locator('#tabAdmin').click();assert 'Калибровка' in page.title();page.locator('#tabWork').click()
 page.locator('.skip-link').focus();page.keyboard.press('Enter');expect(page.locator('#workspace-title')).to_be_focused()
 print('PASS: one visible main heading, updated view titles and working keyboard skip link')
 page.locator('#printAll').click()
 expect(page.locator('#cancelPrint')).to_be_focused()
 dialog=page.locator('#print-review')
 assert dialog.evaluate('(e)=>getComputedStyle(e).overscrollBehaviorY')=='contain'
 assert dialog.evaluate('(e)=>getComputedStyle(e,"::backdrop").overflow')=='hidden'
 overflow_before=page.evaluate('getComputedStyle(document.documentElement).overflowY')
 scroll_before=page.evaluate('scrollY')
 page.mouse.move(4,4);page.mouse.wheel(0,800);page.wait_for_timeout(150)
 scroll_after=page.evaluate('scrollY')
 page.keyboard.press('Escape');expect(dialog).to_be_hidden();expect(page.locator('#printAll')).to_be_focused()
 assert page.evaluate('getComputedStyle(document.documentElement).overflowY')==overflow_before
 print('PASS: safe autofocus, native Escape/focus restoration and backdrop scroll containment; root overflow untouched')
 page.evaluate('() => {window.print=()=>{}}');page.locator('#printOne').click()
 pdf=page.pdf(prefer_css_page_size=True,print_background=False)
 (out/'certificate.pdf').write_bytes(pdf)
 size=re.search(rb'/MediaBox\s*\[\s*0\s+0\s+([0-9.]+)\s+([0-9.]+)\s*\]',pdf)
 assert size, 'PDF page dimensions were not found'
 assert abs(float(size[1])-138*72/25.4)<1 and abs(float(size[2])-99*72/25.4)<1,(size[1],size[2])
 print('PASS: compiled cascade layers preserve the physical 138 × 99 mm PDF page size')

 for width in [320,375,768,1024,1440]:
  page.set_viewport_size({'width':width,'height':1000})
  for size in [16,32]:
   page.evaluate('(size)=>document.documentElement.style.fontSize=size+"px"',size)
   for tab in ['tabWork','tabAdmin']:
    page.locator('#'+tab).click();page.wait_for_timeout(120)
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,size,tab)
 page.evaluate('document.documentElement.style.fontSize=""')
 page.set_viewport_size({'width':375,'height':900});page.locator('#tabWork').click();page.screenshot(path=str(out/'editor-mobile.png'),full_page=True)
 page.goto('http://127.0.0.1:8950',wait_until='networkidle');page.evaluate('document.fonts.ready');page.screenshot(path=str(out/'mobile.png'),full_page=True)
 for width in [320,375,667,768,1024,1440]:
  page.set_viewport_size({'width':width,'height':900})
  for size in [16,32]:
   page.evaluate('(size)=>document.documentElement.style.fontSize=size+"px"',size)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),('landing',width,size)
 page.evaluate('document.documentElement.style.fontSize=""')
 print('PASS: new landing composition reflows at 320–1440px and 200% text, including landscape width')
 assert not errors,errors
 assert not failed,failed
 (out/'observations.json').write_text(json.dumps({'browser':b.version,'scrollBefore':scroll_before,'scrollAfter':scroll_after,'errors':errors,'failedResponses':failed,'textScale':'100% and 200%','viewports':[320,375,768,1024,1440]},ensure_ascii=False,indent=2))
 print('PASS: both editor modes fit 320–1440px at 100%/200% root text scale; no page errors or failed local resources')
 b.close()
