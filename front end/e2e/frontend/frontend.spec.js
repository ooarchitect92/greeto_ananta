import {test,expect} from '@playwright/test';
import fs from 'node:fs';
const features=JSON.parse(fs.readFileSync(new URL('../../src/contracts/features.json',import.meta.url),'utf8'));
function sample(feature){return Object.fromEntries(feature.fields.map(field=>[field.name,field.default!==''?field.default:field.type==='datetime'?'2026-09-07T09:00:00+05:30':field.type==='url'?'https://hooks.example.com/events':field.name==='input_hash'?'a'.repeat(64):'example-ref']));}
async function fill(page,feature){for(const field of feature.fields){const value=sample(feature)[field.name],el=page.locator(`[name="${field.name}"]`);if(field.type==='boolean')await el.setChecked(value===true);else if(field.type==='select')await el.selectOption(value);else if(field.type==='multiselect'){for(const option of field.options)await page.locator(`[name="${field.name}"][value="${option}"]`).setChecked(value.includes(option));}else await el.fill(field.type==='json'?JSON.stringify(value):String(value));}}
test('source tracker search, details and direct link survive reload',async({page})=>{
  await page.goto('/frontend-preview?feature=implementation&task=MIS-001');
  await expect(page.getByRole('heading',{name:'Implementation center',exact:true})).toBeVisible();
  await expect(page.locator('#work-package-detail')).toContainText('MIS-001');
  await page.getByRole('searchbox',{name:'Search IDs and requirements'}).fill('MIS-001');
  await expect(page.getByRole('status')).toContainText('1 of 262');
  await page.reload();await expect(page.locator('#work-package-detail')).toContainText('MIS-001');
});
test('mission draft validates, restores and exports without sending an API request',async({page})=>{
  const apiRequests=[];page.on('request',request=>{if(/\/(api|socket\.io|webhooks)\//.test(new URL(request.url()).pathname))apiRequests.push(request.url());});
  await page.goto('/frontend-preview?feature=missions');
  await page.getByRole('button',{name:'Validate parameters',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Check your parameters');
  await fill(page,features.find(f=>f.id==='missions'));
  await page.getByRole('button',{name:'Validate parameters',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('Browser validation passed');
  await page.getByRole('button',{name:'Save session draft'}).click();
  await expect(page.getByRole('status')).toContainText('No server write occurred');
  await page.reload();await expect(page.locator('[name="name"]')).toHaveValue('example-ref');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export draft JSON'}).click();await download;
  await expect(page.getByRole('button',{name:'Apply to server'})).toBeDisabled();expect(apiRequests).toEqual([]);
});
test('new routes have explicit frontend-only state and no viewport overflow',async({page})=>{
  for(const id of ['missions','knowledge','journey-twin','policy-studio','support-center','billing-controls','implementation']){
    await page.goto(`/frontend-preview?feature=${id}`);await expect(page.getByRole('heading',{level:1})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();
  }
});
test('unknown feature does not silently render a different feature',async({page})=>{await page.goto('/frontend-preview?feature=unknown-feature');await expect(page.getByRole('heading',{name:'Feature not found'})).toBeVisible();});
test('mobile navigation opens, closes with Escape and restores trigger focus',async({page,isMobile})=>{
  test.skip(!isMobile,'Mobile drawer');await page.goto('/frontend-preview');const open=page.getByRole('button',{name:'Open navigation'});await open.click();await expect(page.locator('#greeto-navigation')).toBeVisible();await page.keyboard.press('Escape');await expect(open).toBeFocused();
});
