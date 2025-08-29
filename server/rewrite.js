import * as cheerio from 'cheerio';

function rewriteUrl(url, pageUrl, snapshotPrefix) {
  if (!url) return url;
  // If the URL starts with the snapshot prefix, rewrite to relative path
  if (url.startsWith(snapshotPrefix)) {
    return url.slice(snapshotPrefix.length);
  }
  try {
    const u = new URL(url, pageUrl);
    const pageBase = new URL(pageUrl);
    if (u.origin === pageBase.origin && u.pathname.startsWith(snapshotPrefix)) {
      return u.pathname.slice(snapshotPrefix.length) + u.search + u.hash;
    }
    if (u.origin === pageBase.origin && u.pathname.startsWith('/')) {
      // Remove leading slash for relative path
      return u.pathname.slice(1) + u.search + u.hash;
    }
    return url;
  } catch {
    return url;
  }
}

// Helper to rewrite CSS url() references
function rewriteCssUrls(css, pageUrl, basePrefix) {
  return css.replace(/url\((['"]?)([^'")]+)\1\)/g, (match, quote, assetUrl) => {
    const rewritten = rewriteUrl(assetUrl, pageUrl, basePrefix);
    return `url(${quote}${rewritten}${quote})`;
  });
}

export function rewriteHtmlToLocal(html, pageUrl, basePrefix) {
  const $ = cheerio.load(html);

  // Rewrite asset URLs in tags
  $('img').each((_, el) => {
    const src = $(el).attr('src');
    $(el).attr('src', rewriteUrl(src, pageUrl, basePrefix));
    const srcset = $(el).attr('srcset');
    if (srcset) {
      // Rewrite each srcset entry
      const rewritten = srcset.split(',').map(entry => {
        const [url, size] = entry.trim().split(/\s+/, 2);
        return [rewriteUrl(url, pageUrl, basePrefix), size].filter(Boolean).join(' ');
      }).join(', ');
      $(el).attr('srcset', rewritten);
    }
  });

  $('link').each((_, el) => {
    const href = $(el).attr('href');
    $(el).attr('href', rewriteUrl(href, pageUrl, basePrefix));
  });

  $('script').each((_, el) => {
    const src = $(el).attr('src');
    if (src) $(el).attr('src', rewriteUrl(src, pageUrl, basePrefix));
  });

  $('a').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.startsWith('#')) $(el).attr('href', rewriteUrl(href, pageUrl, basePrefix));
  });

  // Rewrite inline style attributes
  $('[style]').each((_, el) => {
    const style = $(el).attr('style');
    if (style) $(el).attr('style', rewriteCssUrls(style, pageUrl, basePrefix));
  });

  // Rewrite <style> tag contents
  $('style').each((_, el) => {
    const style = $(el).html();
    if (style) $(el).html(rewriteCssUrls(style, pageUrl, basePrefix));
  });

    return $.html();
  }