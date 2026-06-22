const app = document.querySelector("#app");
const nav = document.querySelector(".site-nav");
const navToggle = document.querySelector(".nav-toggle");

let manifest = null;
const contentCache = new Map();

initStarEffects();

navToggle.addEventListener("click", () => {
  const isOpen = nav.classList.toggle("open");
  navToggle.setAttribute("aria-expanded", String(isOpen));
});

nav.addEventListener("click", () => {
  nav.classList.remove("open");
  navToggle.setAttribute("aria-expanded", "false");
});

window.addEventListener("hashchange", renderRoute);
window.addEventListener("DOMContentLoaded", renderRoute);

async function renderRoute() {
  manifest = manifest || await fetchJson("content/index.json");
  const route = normalizeRoute(location.hash);
  updateActiveNav(route);

  if (route === "/") {
    await renderHome();
  } else if (route === "/projects" || route === "/blog" || route === "/achievements") {
    await renderCollection(route.slice(1));
  } else {
    const match = route.match(/^\/(projects|blog|achievements)\/([\w-]+)$/);
    if (match) {
      await renderEntry(match[1], match[2]);
    } else {
      renderNotFound();
    }
  }

  app.focus({ preventScroll: true });
}

function normalizeRoute(hash) {
  const route = hash.replace(/^#/, "") || "/";
  return route.startsWith("/") ? route : `/${route}`;
}

function updateActiveNav(route) {
  document.querySelectorAll("[data-route]").forEach((link) => {
    const linkRoute = link.dataset.route;
    link.classList.toggle(
      "active",
      route === linkRoute || (linkRoute !== "/" && route.startsWith(linkRoute))
    );
  });
}

async function renderHome() {
  const [projects, posts, achievements] = await Promise.all([
    loadCollection("projects"),
    loadCollection("blog"),
    loadCollection("achievements"),
  ]);

  app.innerHTML = `
    <section class="hero">
      <div>
        <p class="eyebrow">Available for thoughtful web work</p>
        <h1 class="hero-title">
          <span>Senya H.</span>
          <span>Wanigasooriya</span>
        </h1>
        <p class="hero-copy">
          ⭐ A collection of projects, achievements, and adventures from a student
          who spends a little too much time thinking about the universe. ⭐
        </p>
        <div class="hero-actions">
          <a class="button primary" href="#/projects">View projects</a>
          <a class="button" href="#/blog">Read blog</a>
        </div>
      </div>
      <aside class="profile-panel" aria-label="Profile highlights">
        <div class="portrait"><span>SW</span></div>
      </aside>
    </section>

    ${sectionPreview("Featured Projects", "Recent work and experiments.", projects.slice(0, 3), "projects")}
    ${sectionPreview("Latest Notes", "Short posts from the build log.", posts.slice(0, 3), "blog")}
    ${timelinePreview(achievements.slice(0, 4))}
  `;
}

async function renderCollection(type) {
  const items = await loadCollection(type);
  const labels = {
    projects: ["Projects", "Case studies, experiments, and shipped work."],
    blog: ["Blog", "Markdown posts, notes, and build reflections."],
    achievements: ["Achievements", "Milestones, awards, certifications, and highlights."],
  };

  const [title, description] = labels[type];
  app.innerHTML = `
    <section class="page-hero">
      <p class="eyebrow">${type}</p>
      <h1>${title}</h1>
      <p>${description}</p>
    </section>
    ${
      type === "achievements"
        ? `<section class="timeline">${items.map(timelineItem).join("")}</section>`
        : `<section class="grid">${items.map((item) => card(item, type)).join("")}</section>`
    }
  `;
}

async function renderEntry(type, slug) {
  const item = (await loadCollection(type)).find((entry) => entry.slug === slug);
  if (!item) {
    renderNotFound();
    return;
  }

  app.innerHTML = `
    <article class="article-body style-${item.meta.style || "deep"}">
      <p class="eyebrow">${type}</p>
      <h1>${escapeHtml(item.meta.title || item.slug)}</h1>
      <p>${escapeHtml(item.meta.summary || "")}</p>
      ${renderMarkdown(item.body)}
      <div class="inline-actions">
        <a class="button" href="#/${type}">Back to ${type}</a>
      </div>
    </article>
  `;
}

function renderNotFound() {
  app.innerHTML = `
    <section class="page-hero">
      <p class="eyebrow">404</p>
      <h1>Page not found.</h1>
      <p>That page is not in the content manifest yet.</p>
      <div class="inline-actions"><a class="button primary" href="#/">Go home</a></div>
    </section>
  `;
}

function sectionPreview(title, description, items, type) {
  return `
    <section class="section">
      <div class="section-head">
        <div>
          <p class="eyebrow">${type}</p>
          <h2>${title}</h2>
        </div>
        <p>${description}</p>
      </div>
      <div class="grid">${items.map((item) => card(item, type)).join("")}</div>
      <div class="inline-actions"><a class="button" href="#/${type}">See all</a></div>
    </section>
  `;
}

function timelinePreview(items) {
  return `
    <section class="section">
      <div class="section-head">
        <div>
          <p class="eyebrow">achievements</p>
          <h2>Achievements</h2>
        </div>
        <p>Highlights ordered from the content manifest.</p>
      </div>
      <div class="timeline">${items.map(timelineItem).join("")}</div>
      <div class="inline-actions"><a class="button" href="#/achievements">See all</a></div>
    </section>
  `;
}

function card(item, type) {
  const meta = item.meta;
  return `
    <a class="card meta-${type.replace(/s$/, "")}" href="#/${type}/${item.slug}">
      <div>
        <div class="card-top">
          <span class="pill">${escapeHtml(meta.date || meta.category || type)}</span>
          <span class="card-link">Open</span>
        </div>
        <h3>${escapeHtml(meta.title || item.slug)}</h3>
        <p>${escapeHtml(meta.summary || "")}</p>
      </div>
      <span class="pill">${escapeHtml(meta.tags || meta.stack || "Markdown")}</span>
    </a>
  `;
}

function timelineItem(item) {
  const meta = item.meta;
  return `
    <a class="timeline-item" href="#/achievements/${item.slug}">
      <time>${escapeHtml(meta.date || "Now")}</time>
      <div>
        <h3>${escapeHtml(meta.title || item.slug)}</h3>
        <p>${escapeHtml(meta.summary || "")}</p>
      </div>
    </a>
  `;
}

async function loadCollection(type) {
  const files = manifest[type] || [];
  const entries = await Promise.all(
    files.map(async (file) => {
      const slug = file.replace(/\.md$/, "");
      const text = await fetchText(`content/${type}/${file}`);
      const parsed = parseFrontMatter(text);
      return { slug, ...parsed };
    })
  );

  return entries.sort((a, b) => {
    const ao = Number(a.meta.order ?? 999);
    const bo = Number(b.meta.order ?? 999);
    return ao - bo;
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}`);
  return response.json();
}

async function fetchText(url) {
  if (contentCache.has(url)) return contentCache.get(url);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not load ${url}`);
  const text = await response.text();
  contentCache.set(url, text);
  return text;
}

function parseFrontMatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { meta: {}, body: text };

  const meta = {};
  match[1].split("\n").forEach((line) => {
    const separator = line.indexOf(":");
    if (separator === -1) return;
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^["']|["']$/g, "");
    meta[key] = value;
  });

  return { meta, body: match[2].trim() };
}

function renderMarkdown(markdown) {
  const lines = markdown.split("\n");
  const html = [];
  let listOpen = false;
  let codeOpen = false;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length) {
      html.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
      paragraph = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      flushParagraph();
      if (listOpen) {
        html.push("</ul>");
        listOpen = false;
      }
      html.push(codeOpen ? "</code></pre>" : "<pre><code>");
      codeOpen = !codeOpen;
      continue;
    }

    if (codeOpen) {
      html.push(escapeHtml(line));
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      if (listOpen) {
        html.push("</ul>");
        listOpen = false;
      }
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      if (listOpen) {
        html.push("</ul>");
        listOpen = false;
      }
      const level = heading[1].length;
      html.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      if (!listOpen) {
        html.push("<ul>");
        listOpen = true;
      }
      html.push(`<li>${inlineMarkdown(bullet[1])}</li>`);
      continue;
    }

    const quote = line.match(/^>\s+(.+)$/);
    if (quote) {
      flushParagraph();
      html.push(`<blockquote>${inlineMarkdown(quote[1])}</blockquote>`);
      continue;
    }

    paragraph.push(line.trim());
  }

  flushParagraph();
  if (listOpen) html.push("</ul>");
  if (codeOpen) html.push("</code></pre>");
  return html.join("\n");
}

function inlineMarkdown(value) {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" rel="noreferrer">$1</a>');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function initStarEffects() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const starsLayer = document.createElement("div");
  starsLayer.className = "floating-stars";
  starsLayer.setAttribute("aria-hidden", "true");
  document.body.append(starsLayer);

  const starShapes = ["✦", "✧", "⋆", "✶"];
  const floatingStars = Array.from({ length: 58 }, (_, index) => {
    const star = document.createElement("span");
    star.className = "floating-star";
    star.textContent = starShapes[index % starShapes.length];
    starsLayer.append(star);

    return {
      element: star,
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() * 0.3 + 0.08) * (Math.random() > 0.5 ? 1 : -1),
      vy: (Math.random() * 0.24 + 0.07) * (Math.random() > 0.5 ? 1 : -1),
      size: Math.random() * 13 + 7,
      rotation: Math.random() * 360,
      spin: Math.random() * 0.42 - 0.21,
    };
  });

  const moveFloatingStars = () => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    floatingStars.forEach((star) => {
      star.x += star.vx;
      star.y += star.vy;
      star.rotation += star.spin;

      if (star.x <= 0 || star.x >= width - star.size) star.vx *= -1;
      if (star.y <= 0 || star.y >= height - star.size) star.vy *= -1;

      star.element.style.transform = `translate3d(${star.x}px, ${star.y}px, 0) rotate(${star.rotation}deg)`;
      star.element.style.fontSize = `${star.size}px`;
    });

    if (!reducedMotion) requestAnimationFrame(moveFloatingStars);
  };

  moveFloatingStars();

  if (!window.matchMedia("(pointer: fine)").matches) return;

  const cursor = document.createElement("div");
  cursor.className = "star-cursor";
  cursor.textContent = "✦";
  cursor.setAttribute("aria-hidden", "true");
  document.body.append(cursor);

  let trailIndex = 0;
  const trail = Array.from({ length: 14 }, (_, index) => {
    const star = document.createElement("span");
    star.className = "cursor-trail-star";
    star.textContent = index % 3 === 0 ? "✧" : "✦";
    document.body.append(star);
    return star;
  });

  window.addEventListener("mousemove", (event) => {
    cursor.style.transform = `translate3d(${event.clientX}px, ${event.clientY}px, 0) translate(-50%, -50%)`;

    const star = trail[trailIndex];
    trailIndex = (trailIndex + 1) % trail.length;
    star.style.left = `${event.clientX}px`;
    star.style.top = `${event.clientY}px`;
    star.style.animation = "none";
    star.offsetHeight;
    star.style.animation = "starTrail 720ms ease-out forwards";
  });
}
