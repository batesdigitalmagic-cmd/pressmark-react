/*
 * The site's navigation, as data.
 *
 * Its own module rather than a constant beside the component: a file that
 * exports both a component and a value cannot be hot-reloaded as a component,
 * and this list is read by the shell today and by anything that needs to know
 * the site's shape tomorrow.
 *
 * The tool comes first because it is what the site is for. Services, Pricing
 * and the custom-publication link are the studio's business, kept as three
 * plain links rather than the marketing pages they replaced — a customer who
 * wants a price can find one in a second, and nobody has to scroll past a sales
 * page to reach the thing they came to use.
 */

export const NAV_GROUPS = [
  [
    { label: "Create a PDF", href: "/" },
    { label: "Directory Designs", href: "/directory-designs" },
    /* The Data Merge section is for buyers. The Blog (/blog, the daily feed)
       is deliberately not in the sidebar; it is reached from the Data Merge
       section and from its own articles. */
    { label: "Data Merge", href: "/data-merge" },
  ],
  [
    { label: "Services", href: "/services" },
    { label: "Pricing", href: "/pricing" },
    { label: "Need a Custom Publication?", href: "/contact" },
  ],
];
