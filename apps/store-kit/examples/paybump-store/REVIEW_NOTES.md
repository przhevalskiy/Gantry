# PayBump — notes for store reviewers

## Single purpose
Stripe and invoice dunning macros

## Expected permissions
See `PERMISSIONS.md`. Local-only storage; no account.

## Test plan (≈ 2 minutes)
1. Install the extension and open the popup.
2. Confirm the UI shows **PayBump** and the core controls.
3. Focus a text box, open PayBump, click Friendly card update.
4. Type ;card then Space and confirm expansion.
5. Confirm no login wall and no unexpected network calls for core local features.

## Account / payments
None in the local version.

## Trademarks
Listing does not claim affiliation with third-party platforms.
