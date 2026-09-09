async page => {
  await page.setViewportSize({width:1440, height:900});
  await page.waitForTimeout(1500);
  await page.screenshot({path:'qa/T-new-1440.png'});
  await page.setViewportSize({width:1280, height:720});
  await page.waitForTimeout(700);
  await page.screenshot({path:'qa/T-new-720.png'});
  await page.setViewportSize({width:900, height:820});
  await page.waitForTimeout(700);
  await page.screenshot({path:'qa/T-new-900.png'});
  await page.setViewportSize({width:420, height:820});
  await page.waitForTimeout(700);
  await page.screenshot({path:'qa/T-new-phone.png'});
  await page.setViewportSize({width:1440, height:900});
}
