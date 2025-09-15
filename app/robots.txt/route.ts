export function GET() {
  const domain = "https://json-analyzer.raphaelcomandon-portfolio.fr";
  const body = [
    "User-agent: *",
    "Allow: /",
    `Sitemap: ${domain}/sitemap.xml`,
  ].join("\n");

  return new Response(body, {
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}
