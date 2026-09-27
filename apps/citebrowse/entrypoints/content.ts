export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // Capture is driven from the popup via executeScript(extractCitationMeta).
  },
});
