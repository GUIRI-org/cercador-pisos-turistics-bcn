---
toc: false
theme: [air, ocean-floor, wide]
---

# Pisos turístics per districte i barri

<style>
.nav-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1rem;
}

.nav-card {
  display: grid;
  gap: 0.6rem;
  padding: 1rem;
  min-height: 130px;
}

.nav-card h2,
.nav-card p {
  margin: 0;
}

.nav-card h2 {
  font-size: 1.1rem;
}

.nav-card p {
  color: var(--theme-foreground-muted);
  font-size: 0.9rem;
  line-height: 1.35;
}

.nav-card a {
  align-self: end;
  font-weight: 700;
}
</style>

<div class="nav-card-grid">
  <article class="card nav-card">
    <h2>Districts</h2>
    <p>District-level cards with apartments, places, buildings, and active streets.</p>
    <a href="./districts">Open districts</a>
  </article>
  <article class="card nav-card">
    <h2>Neighbourhoods</h2>
    <p>Barrio cards ordered by apartment count, with places and district context.</p>
    <a href="./neighbourhoods">Open neighbourhoods</a>
  </article>
  <article class="card nav-card">
    <h2>Streets</h2>
    <p>Street cards with building, apartment, and place totals by street.</p>
    <a href="./streets">Open streets</a>
  </article>
  <article class="card nav-card">
    <h2>Charts</h2>
    <p>Visual distributions by district and neighbourhood.</p>
    <a href="./charts">Open charts</a>
  </article>
  <article class="card nav-card">
    <h2>Data tables</h2>
    <p>Searchable summary and raw API apartment tables.</p>
    <a href="./data-tables">Open tables</a>
  </article>
</div>
