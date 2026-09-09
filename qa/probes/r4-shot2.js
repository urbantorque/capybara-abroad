async page => {
  await page.evaluate(() => {
    document.querySelectorAll('.capyui-setmute')[2].click();
    document.querySelectorAll('.capyui-setrange')[1].value = '35';
    document.querySelectorAll('.capyui-setrange')[1].dispatchEvent(new Event('input', { bubbles: true }));
    const b = document.querySelector('.capyui-setcalm input');
    b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.evaluate(() => new Promise(r => setTimeout(r, 700)));
}
