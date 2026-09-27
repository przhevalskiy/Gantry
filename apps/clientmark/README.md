# ClientMark

Color-label **Meta Ads** and **Google Ads** client accounts.

- Extension badge with client initials  
- Tab title prefix `【Client】`  
- 4px color bar on the page  

Match rules are simple URL substrings (e.g. `act=123456`).

## Stack

WXT (MV3) · React 19 · TypeScript · Tailwind v4 · `chrome.storage.local`

## Develop

```bash
npm install
npm run dev
npm test && npm run compile && npm run build
```

## Who it serves

Media buyers and agencies juggling many ad accounts across tabs.
