---
title: Cercador de pisos turístics Barcelona
toc: false
---

# Cercador de pisos turístics Barcelona

<link rel="stylesheet" href="./styles.css">

Cerca una adreça de Barcelona per identificar habitatges amb llicència turística.

## Cerca per adreça

Selecciona el tipus de via, el carrer i el número per identificar una adreça de Barcelona.

```js
{
  const BASE = "https://geoportal.barcelona.cat/geoBCN/serveis/territori";
  const GUIRI_API_BASE = process.env.OBSERVABLE_APP_GUIRI_API_BASE || "http://127.0.0.1:9092";

  // ── Parallax scene shells ───────────────────────────────────────────────────
  const scene = document.createElement("section");
  scene.className = "geo-scene";

  const planeBack = document.createElement("div");
  planeBack.className = "geo-plane geo-plane-back";

  const planeMid = document.createElement("div");
  planeMid.className = "geo-plane geo-plane-mid";
  planeMid.innerHTML = `
    <div class="geo-mid-pattern"></div>`;
  const midPattern = planeMid.querySelector(".geo-mid-pattern");

  const planeThird = document.createElement("div");
  planeThird.className = "geo-plane geo-plane-third";
  planeThird.innerHTML = `
    <div class="geo-image-placeholder geo-third-image">HORIZONTAL LAYER</div>`;

  // ── Helper: labelled field ───────────────────────────────────────────────────
  const field = (labelText, required, content) => {
    const wrap = document.createElement("div");
    const lbl  = document.createElement("label");
    lbl.className = "geo-label";
    lbl.textContent = labelText;
    if (required) {
      const star = document.createElement("span");
      star.className = "geo-req"; star.textContent = " *";
      lbl.appendChild(star);
    }
    wrap.appendChild(lbl);
    wrap.appendChild(content);
    return { wrap, lbl };
  };

  // ── ROW 1 ───────────────────────────────────────────────────────────────────
  const formPanel = document.createElement("div");
  formPanel.className = "geo-form-panel geo-content";
  const row1 = document.createElement("div"); row1.className = "geo-row1";

  // — Tipo Vía select —
  const tipusWrap = document.createElement("div"); tipusWrap.className = "geo-select-wrap";
  const tipusSel  = document.createElement("select"); tipusSel.className = "geo-control"; tipusSel.id = "tipusViaInp";
  tipusSel.appendChild(Object.assign(document.createElement("option"), { value: "", textContent: "Seleccione una opción" }));
  tipusWrap.appendChild(tipusSel);
  const { wrap: tipusField, lbl: tipusLbl } = field("Tipo Vía:", false, tipusWrap);
  tipusLbl.htmlFor = "tipusViaInp";

  // — Carrer autocomplete —
  const carrerPos = document.createElement("div"); carrerPos.className = "geo-relative";
  const carrerInp = document.createElement("input");
  Object.assign(carrerInp, { type: "text", id: "carrerInp", className: "geo-control", placeholder: "Escriu el nom del carrer…" });
  const carrerList = document.createElement("ul"); carrerList.className = "geo-autocomplete-list";
  carrerPos.appendChild(carrerInp); carrerPos.appendChild(carrerList);
  const { wrap: carrerField, lbl: carrerLbl } = field("Calle:", true, carrerPos);
  carrerLbl.htmlFor = "carrerInp";

  // — Número (datalist-backed input) —
  const dlId = "geo-num-dl-" + Math.random().toString(36).slice(2);
  const numDl  = document.createElement("datalist"); numDl.id = dlId;
  const numInp = document.createElement("input");
  Object.assign(numInp, { type: "text", id: "numInp", className: "geo-control", placeholder: "–", disabled: true });
  numInp.setAttribute("list", dlId);
  const numContainer = document.createElement("div");
  numContainer.appendChild(numInp); numContainer.appendChild(numDl);
  const { wrap: numField, lbl: numLbl } = field("Número:", true, numContainer);
  numLbl.htmlFor = "numInp";

  row1.appendChild(tipusField);
  row1.appendChild(carrerField);
  row1.appendChild(numField);
  formPanel.appendChild(row1);

  // ── Result card ─────────────────────────────────────────────────────────────
  const resultDiv = document.createElement("div"); resultDiv.className = "geo-result geo-content";

  // ── Viviendas de uso turístico results ──────────────────────────────────────
  const hutResultsDiv = document.createElement("div"); hutResultsDiv.className = "geo-hut-results geo-content";
  const hutStreetResultsDiv = document.createElement("div"); hutStreetResultsDiv.className = "geo-hut-results geo-hut-results-secondary geo-content";

  // ── Link Guia BCN ────────────────────────────────────────────────────────────
  const linkP = document.createElement("p"); linkP.className = "geo-link-guia geo-content";
  linkP.innerHTML = `Per obtenir ajuda per concretar el lloc dels fets, consulteu el
    <a href="https://geoportal.barcelona.cat/planolBCN/ca/" target="_blank" rel="noopener noreferrer">plànol de BCN</a>.`;

  const parallaxTip = document.createElement("p");
  parallaxTip.className = "geo-parallax-tip geo-content";
  parallaxTip.textContent = "Scroll this panel to test the parallax layers.";

  scene.appendChild(planeBack);
  scene.appendChild(planeMid);
  scene.appendChild(planeThird);
  scene.appendChild(formPanel);
  scene.appendChild(parallaxTip);
  scene.appendChild(resultDiv);
  scene.appendChild(hutResultsDiv);
  scene.appendChild(hutStreetResultsDiv);
  scene.appendChild(linkP);

  // ── State ───────────────────────────────────────────────────────────────────
  let selectedVia  = null;   // via object from /territori response
  let storedAdreces = [];    // adreces from last search call
  let hutTimer;
  let hutRequestId = 0;

  const setPageScrollEnabled = (enabled) => {
    document.documentElement.style.overflowY = enabled ? "auto" : "hidden";
    document.body.style.overflowY = enabled ? "auto" : "hidden";
  };

  setPageScrollEnabled(false);

  // ── Load Tipus Vies ─────────────────────────────────────────────────────────
  try {
    const tv = await fetch(`${BASE}/tipusvies`).then(r => r.json());
    (tv.resultats || [])
      .sort((a, b) => a.nom.localeCompare(b.nom, "ca"))
      .forEach(t => {
        const o = document.createElement("option");
        o.value = t.codi; o.dataset.abr = t.abreviatura; o.dataset.nom = t.nom;
        o.textContent = `${t.abreviatura} – ${t.nom}`;
        tipusSel.appendChild(o);
      });
  } catch { /* non-critical */ }

  // Reset calle when via type changes
  tipusSel.addEventListener("change", () => {
    carrerInp.value = ""; carrerList.style.display = "none";
    resetStreet();
  });

  // ── Street autocomplete ─────────────────────────────────────────────────────
  const resetStreet = () => {
    selectedVia = null; storedAdreces = [];
    numInp.value = ""; numInp.disabled = true; numDl.innerHTML = "";
    resultDiv.style.display = "none";
    clearHutResults();
    setPageScrollEnabled(false);
  };

  const clearHutResults = () => {
    hutResultsDiv.style.display = "none";
    hutResultsDiv.innerHTML = "";
    hutStreetResultsDiv.style.display = "none";
    hutStreetResultsDiv.innerHTML = "";
  };

  let carrerTimer;
  carrerInp.addEventListener("input", () => {
    clearTimeout(carrerTimer);
    resetStreet();
    const q = carrerInp.value.trim();
    if (q.length < 2) { carrerList.style.display = "none"; return; }

    carrerTimer = setTimeout(async () => {
      try {
        const selOpt  = tipusSel.selectedOptions[0];
        const tipusAbr = selOpt?.dataset?.abr;
        const query    = tipusAbr ? `${tipusAbr} ${q}` : q;
        const json     = await fetch(`${BASE}?q=${encodeURIComponent(query)}`).then(r => r.json());

        const tipusCodi = tipusSel.value;
        storedAdreces   = json.resultats?.adreces || [];
        const vies      = (json.resultats?.vies   || [])
          .filter(v => !tipusCodi || v.tipusVia?.codi === tipusCodi);

        carrerList.innerHTML = "";
        if (!vies.length) {
          const li = document.createElement("li"); li.className = "geo-empty";
          li.textContent = "Cap carrer trobat"; carrerList.appendChild(li);
        } else {
          vies.forEach(via => {
            const li = document.createElement("li");
            li.textContent = via.nomComplet || `${via.tipusVia?.nom || ""} ${via.nom}`;
            li.addEventListener("mousedown", e => {
              e.preventDefault();
              carrerInp.value   = li.textContent;
              selectedVia       = via;
              carrerList.style.display = "none";
              populateNumbers(via.codi);
            });
            carrerList.appendChild(li);
          });
        }
        carrerList.style.display = "block";
      } catch { carrerList.style.display = "none"; }
    }, 300);
  });

  document.addEventListener("click", e => {
    if (!carrerPos.contains(e.target)) carrerList.style.display = "none";
  });

  // ── Populate Número datalist ────────────────────────────────────────────────
  const populateNumbers = (viaCodi) => {
    numDl.innerHTML = "";
    const viaAdreces = storedAdreces.filter(a => a.carrer?.codi === viaCodi);
    const nums = [...new Set(viaAdreces.map(a => a.numeracioPostal))]
      .filter(Boolean)
      .sort((a, b) => {
        const na = parseInt(a, 10), nb = parseInt(b, 10);
        return (!isNaN(na) && !isNaN(nb)) ? na - nb : a.localeCompare(b, "ca");
      });
    nums.forEach(n => {
      const o = document.createElement("option"); o.value = n; numDl.appendChild(o);
    });
    numInp.disabled = false;
    numInp.focus();
  };

  // ── Build result card ────────────────────────────────────────────────────────
  const updateResult = () => {
    if (!selectedVia || !numInp.value.trim()) {
      resultDiv.style.display = "none";
      clearHutResults();
      setPageScrollEnabled(false);
      return;
    }

    resultDiv.style.display = "block";
    resultDiv.innerHTML = `
      <strong>${carrerInp.value}, ${numInp.value.trim()}</strong>
      <div class="geo-result-meta">
        ${selectedVia.tipusVia?.nom || ""} &nbsp;·&nbsp; Codi via: ${selectedVia.codi}
        &nbsp;·&nbsp; Barcelona
      </div>`;

    const carrerNom = selectedVia?.nom || carrerInp.value.trim();
    const tipusCarrer = selectedVia?.tipusVia?.nom || tipusSel.selectedOptions[0]?.dataset?.nom || null;
    const num1 = numInp.value.trim() || null;
    searchHutResults(carrerNom, tipusCarrer, num1);
  };

  const escapeHtml = (value) => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  const renderHutResults = (container, title, addressGroups) => {
    if (!addressGroups.length) {
      container.innerHTML = `
        <h4 class="geo-hut-title">${title}</h4>
        <p class="geo-hut-status">No s'han trobat habitatges d'ús turístic.</p>`;
      return;
    }

    const totalApartments = addressGroups.reduce((s, g) => s + g.apartments_count, 0);
    const items = addressGroups.map(group => {
      const district = [group.nom_districte, group.nom_barri].filter(Boolean).join(" · ");
      const apts = group.apartments.map(a => {
        const pisParta = [a.pis, a.porta].filter(Boolean).join("/");
        return `<li class="geo-hut-apt-item">
          Expedient: ${escapeHtml(a.expedient || "-")}
          &nbsp;·&nbsp; Registre: ${escapeHtml(a.registre_generalitat || "-")}
          &nbsp;·&nbsp; Places: ${escapeHtml(String(a.num_places ?? "-"))}
          ${pisParta ? `&nbsp;·&nbsp; Pis/Porta: ${escapeHtml(pisParta)}` : ""}
        </li>`;
      }).join("");
      return `<li class="geo-hut-item">
        <div class="geo-hut-item-title">${escapeHtml(group.address || "Adreça no disponible")}</div>
        ${district ? `<div class="geo-hut-item-meta">${escapeHtml(district)}</div>` : ""}
        <div class="geo-hut-item-meta">${group.apartments_count} habitatge(s) · ${group.total_places} places</div>
        <ul class="geo-hut-apt-list">${apts}</ul>
      </li>`;
    }).join("");

    container.innerHTML = `
      <h4 class="geo-hut-title">${title} (${totalApartments} habitatge(s) en ${addressGroups.length} adreça(es))</h4>
      <ul class="geo-hut-list">${items}</ul>`;
  };

  const fetchApartmentsByAddress = async (params, requestId) => {
    if (requestId !== hutRequestId) return null;
    const qs = new URLSearchParams();
    if (params.carrer) qs.set("carrer", params.carrer);
    if (params.num1 !== undefined && params.num1 !== null && params.num1 !== "") qs.set("num1", String(params.num1));
    if (params.tipus_carrer) qs.set("tipus_carrer", params.tipus_carrer);
    const url = `${GUIRI_API_BASE}/api/v1/apartments/search?${qs}`;
    const json = await fetch(url).then(r => r.json());
    if (requestId !== hutRequestId) return null;
    return json?.data || [];
  };

  const searchHutResults = (carrer, tipusCarrer, num1) => {
    clearTimeout(hutTimer);
    if (!carrer) {
      clearHutResults();
      return;
    }

    hutTimer = setTimeout(async () => {
      const requestId = ++hutRequestId;
      hutResultsDiv.style.display = "block";
      hutStreetResultsDiv.style.display = "block";
      hutResultsDiv.innerHTML = "<div class=\"geo-hut-status\">Cercant habitatges turístics...</div>";
      hutStreetResultsDiv.innerHTML = "<div class=\"geo-hut-status\">Cercant habitatges turístics al carrer...</div>";

      try {
        const [exactGroups, streetGroups] = await Promise.all([
          fetchApartmentsByAddress({ carrer, tipus_carrer: tipusCarrer, num1 }, requestId),
          fetchApartmentsByAddress({ carrer, tipus_carrer: tipusCarrer }, requestId)
        ]);
        if (requestId !== hutRequestId) return;
        if (!exactGroups || !streetGroups) return;

        renderHutResults(
          hutResultsDiv,
          "Habitatges d'ús turístic (adreça amb número)",
          exactGroups
        );
        renderHutResults(
          hutStreetResultsDiv,
          "Habitatges d'ús turístic (carrer, sense número)",
          streetGroups
        );
        setPageScrollEnabled(true);
      } catch {
        if (requestId !== hutRequestId) return;
        hutResultsDiv.innerHTML = `
          <h4 class="geo-hut-title">Habitatges d'ús turístic (adreça amb número)</h4>
          <p class="geo-hut-status">No s'ha pogut consultar el servei en aquest moment.</p>`;
        hutStreetResultsDiv.innerHTML = `
          <h4 class="geo-hut-title">Habitatges d'ús turístic (carrer, sense número)</h4>
          <p class="geo-hut-status">No s'ha pogut consultar el servei en aquest moment.</p>`;
        setPageScrollEnabled(true);
      }
    }, 350);
  };

  [numInp].forEach(el =>
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", updateResult)
  );

  let parallaxTicking = false;
  const updateParallax = () => {
    const yScroll = window.scrollY || document.documentElement.scrollTop || 0;
    planeMid.style.transform = `translate3d(0, ${(-yScroll * 0.08).toFixed(2)}px, 0)`;
    if (midPattern) {
      midPattern.style.backgroundPosition = `center ${(-yScroll * 0.35).toFixed(2)}px`;
    }
    planeThird.style.transform = `translate3d(${(yScroll * 0.12).toFixed(2)}px, 0, 0)`;
    parallaxTicking = false;
  };

  const scheduleParallax = () => {
    if (parallaxTicking) return;
    parallaxTicking = true;
    requestAnimationFrame(updateParallax);
  };

  window.addEventListener("scroll", scheduleParallax, { passive: true });
  scheduleParallax();

  display(scene);

  // ── JS sticky polyfill — works regardless of Observable ancestor overflow ──
  // We record the form's natural top offset once it's in the DOM, then on every
  // scroll event we switch between in-flow and position:fixed so it always
  // stays visible at the top of the viewport.
  let formNaturalTop = null;
  let formIsFixed = false;

  const syncStickyForm = () => {
    if (formNaturalTop === null) {
      // First call: measure natural offset from document top
      const rect = formPanel.getBoundingClientRect();
      formNaturalTop = rect.top + window.scrollY;
    }

    const shouldFix = window.scrollY >= formNaturalTop;

    if (shouldFix && !formIsFixed) {
      formIsFixed = true;
      formPanel.classList.add("geo-form-panel--fixed");
      // Prevent content jump: push the next sibling down by the form's height
      parallaxTip.style.marginTop = formPanel.offsetHeight + "px";
    } else if (!shouldFix && formIsFixed) {
      formIsFixed = false;
      formPanel.classList.remove("geo-form-panel--fixed");
      parallaxTip.style.marginTop = "";
    }
  };

  // Re-measure after fonts/layout settle, then attach scroll listener
  requestAnimationFrame(() => {
    formNaturalTop = null; // reset so first syncStickyForm call measures fresh
    syncStickyForm();
    window.addEventListener("scroll", syncStickyForm, { passive: true });
  });
}
```
