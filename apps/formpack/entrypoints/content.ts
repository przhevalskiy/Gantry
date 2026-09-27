export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  main() {
    // Fill is invoked from the popup via executeScript(fillFormFields).
  },
});
