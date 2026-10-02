export default defineBackground(() => {
  browser.commands.onCommand.addListener(async (command) => {
    const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return;
    if (command === 'speed-up') {
      await browser.tabs.sendMessage(tab.id, { type: 'mediaboost:nudge-speed', delta: 0.25 });
    } else if (command === 'speed-down') {
      await browser.tabs.sendMessage(tab.id, { type: 'mediaboost:nudge-speed', delta: -0.25 });
    } else if (command === 'boost-toggle') {
      await browser.tabs.sendMessage(tab.id, { type: 'mediaboost:toggle-boost' });
    }
  });
});
