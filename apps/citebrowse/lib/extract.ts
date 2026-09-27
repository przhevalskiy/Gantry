/** Page-world metadata extractor — no imports (executeScript-safe). */
export function extractCitationMeta(): {
  title: string;
  authors: string;
  year: string;
  journal: string;
  doi: string;
  url: string;
  publisher: string;
} {
  const meta = (name: string) =>
    (
      document.querySelector(`meta[name="${name}"]`) ||
      document.querySelector(`meta[property="${name}"]`) ||
      document.querySelector(`meta[name="${name.toLowerCase()}"]`)
    )?.getAttribute('content')?.trim() || '';

  const citationMeta = (field: string) =>
    document.querySelector(`meta[name="citation_${field}"]`)?.getAttribute('content')?.trim() ||
    document.querySelector(`meta[name="DC.${field}"]`)?.getAttribute('content')?.trim() ||
    document.querySelector(`meta[name="DC.Identifier"][scheme="doi"]`)?.getAttribute('content')?.trim() ||
    '';

  const authors = Array.from(
    document.querySelectorAll(
      'meta[name="citation_author"], meta[name="DC.Creator"], meta[name="author"]',
    ),
  )
    .map((el) => el.getAttribute('content')?.trim() || '')
    .filter(Boolean)
    .join(' and ');

  let doi =
    citationMeta('doi') ||
    meta('doi') ||
    document.body.innerText.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+/i)?.[0] ||
    '';

  const yearRaw =
    citationMeta('publication_date') ||
    citationMeta('date') ||
    meta('citation_year') ||
    meta('DC.Date') ||
    '';
  const year = (yearRaw.match(/\d{4}/) || [])[0] || '';

  return {
    title:
      citationMeta('title') ||
      meta('og:title') ||
      meta('citation_title') ||
      document.title.split('|')[0]?.trim() ||
      document.title,
    authors: authors || meta('author'),
    year,
    journal: citationMeta('journal_title') || meta('citation_journal_title') || '',
    doi,
    url: citationMeta('public_url') || location.href,
    publisher: meta('citation_publisher') || meta('publisher') || '',
  };
}
