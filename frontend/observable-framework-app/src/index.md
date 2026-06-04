# Cercador de pisos turístics Barcelona

Cerca una adreça de Barcelona per identificar habitatges amb llicència turística.

## Cerca per adreça

Selecciona el tipus de via, el carrer i el número per identificar una adreça de Barcelona.

```js
{
  const BASE = "https://geoportal.barcelona.cat/geoBCN/serveis/territori";

  // ── Shared styles ───────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    .geo-label { font-size: 13px; color: #374151; margin-bottom: 4px; display: block; font-weight: 500; }
    .geo-req   { color: #ef4444; }
    .geo-control {
      width: 100%; padding: 8px 12px; font-size: 14px;
      border: 1px solid #d1d5db; border-radius: 6px; box-sizing: border-box;
      background: #fff; color: #111827; height: 38px; appearance: none;
    }
    .geo-control:focus {
      outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,.15);
    }
    .geo-control:disabled { background: #f3f4f6; color: #9ca3af; cursor: not-allowed; }
    .geo-select-wrap { position: relative; }
    .geo-select-wrap::after {
      content: ""; pointer-events: none; position: absolute;
      right: 12px; top: 50%; transform: translateY(-50%);
      border: 5px solid transparent; border-top: 6px solid #6b7280;
    }
    .geo-select-wrap select { padding-right: 32px; cursor: pointer; }
    .geo-row1 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }
    .geo-row2 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
    @media (max-width: 540px) {
      .geo-row1 { grid-template-columns: 1fr; }
      .geo-row2 { grid-template-columns: 1fr 1fr; }
    }
    .geo-autocomplete-list {
      position: absolute; top: calc(100% + 2px); left: 0; right: 0;
      background: #fff; border: 1px solid #d1d5db; border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0,0,0,.1);
      list-style: none; margin: 0; padding: 4px 0;
      max-height: 210px; overflow-y: auto; z-index: 60; display: none;
    }
    .geo-autocomplete-list li {
      padding: 9px 12px; font-size: 14px; cursor: pointer; color: #111827;
    }
    .geo-autocomplete-list li:hover { background: #eff6ff; }
    .geo-autocomplete-list li.geo-empty { color: #9ca3af; cursor: default; }
    .geo-autocomplete-list li.geo-empty:hover { background: transparent; }
    .geo-result {
      border: 1px solid #bbf7d0; border-radius: 8px; padding: 14px 16px;
      background: #f0fdf4; font-size: 14px; display: none;
    }
    .geo-result strong { font-size: 15px; color: #15803d; }
    .geo-result-meta { color: #6b7280; margin-top: 5px; font-size: 13px; }
    .geo-link-guia { font-size: 13px; color: #6b7280; margin-top: 16px; }
    .geo-link-guia a { color: #3b82f6; }
  `;
  document.head.appendChild(style);

  // ── Root wrapper ────────────────────────────────────────────────────────────
  const root = document.createElement("div");
  root.style.cssText = "max-width: 680px; font-family: sans-serif;";

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
  const row1 = document.createElement("div"); row1.className = "geo-row1";

  // — Tipo Vía select —
  const tipusWrap = document.createElement("div"); tipusWrap.className = "geo-select-wrap";
  const tipusSel  = document.createElement("select"); tipusSel.className = "geo-control"; tipusSel.id = "tipusViaInp";
  tipusSel.appendChild(Object.assign(document.createElement("option"), { value: "", textContent: "Seleccione una opción" }));
  tipusWrap.appendChild(tipusSel);
  const { wrap: tipusField, lbl: tipusLbl } = field("Tipo Vía:", false, tipusWrap);
  tipusLbl.htmlFor = "tipusViaInp";

  // — Carrer autocomplete —
  const carrerPos = document.createElement("div"); carrerPos.style.position = "relative";
  const carrerInp = document.createElement("input");
  Object.assign(carrerInp, { type: "text", id: "carrerInp", className: "geo-control", placeholder: "Escriu el nom del carrer…" });
  const carrerList = document.createElement("ul"); carrerList.className = "geo-autocomplete-list";
  carrerPos.appendChild(carrerInp); carrerPos.appendChild(carrerList);
  const { wrap: carrerField, lbl: carrerLbl } = field("Calle:", true, carrerPos);
  carrerLbl.htmlFor = "carrerInp";

  row1.appendChild(tipusField);
  row1.appendChild(carrerField);
  root.appendChild(row1);

  // ── ROW 2 ───────────────────────────────────────────────────────────────────
  const row2 = document.createElement("div"); row2.className = "geo-row2";

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

  // — Piso / Escalera / Puerta —
  const makeText = (id, lbl) => {
    const inp = document.createElement("input");
    Object.assign(inp, { type: "text", id, className: "geo-control" });
    const { wrap } = field(lbl + ":", false, inp);
    const label = wrap.querySelector("label"); label.htmlFor = id;
    return { wrap, inp };
  };
  const { wrap: pisoField,     inp: pisoInp     } = makeText("pisoInp",     "Piso");
  const { wrap: escaleraField, inp: escaleraInp } = makeText("escaleraInp", "Escalera");
  const { wrap: puertaField,   inp: puertaInp   } = makeText("puertaInp",   "Puerta");

  row2.appendChild(numField);
  row2.appendChild(pisoField);
  row2.appendChild(escaleraField);
  row2.appendChild(puertaField);
  root.appendChild(row2);

  // ── Result card ─────────────────────────────────────────────────────────────
  const resultDiv = document.createElement("div"); resultDiv.className = "geo-result";
  root.appendChild(resultDiv);

  // ── Link Guia BCN ────────────────────────────────────────────────────────────
  const linkP = document.createElement("p"); linkP.className = "geo-link-guia";
  linkP.innerHTML = `Per obtenir ajuda per concretar el lloc dels fets, consulteu el
    <a href="https://geoportal.barcelona.cat/planolBCN/ca/" target="_blank" rel="noopener noreferrer">plànol de BCN</a>.`;
  root.appendChild(linkP);

  // ── State ───────────────────────────────────────────────────────────────────
  let selectedVia  = null;   // via object from /territori response
  let storedAdreces = [];    // adreces from last search call

  // ── Load Tipus Vies ─────────────────────────────────────────────────────────
  try {
    const tv = await fetch(`${BASE}/tipusvies`).then(r => r.json());
    (tv.resultats || [])
      .sort((a, b) => a.nom.localeCompare(b.nom, "ca"))
      .forEach(t => {
        const o = document.createElement("option");
        o.value = t.codi; o.dataset.abr = t.abreviatura;
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
    if (!selectedVia || !numInp.value.trim()) { resultDiv.style.display = "none"; return; }
    const extra = [
      pisoInp.value.trim()     ? `Pis ${pisoInp.value.trim()}`      : "",
      escaleraInp.value.trim() ? `Esc. ${escaleraInp.value.trim()}`  : "",
      puertaInp.value.trim()   ? `Porta ${puertaInp.value.trim()}`   : "",
    ].filter(Boolean).join(", ");

    resultDiv.style.display = "block";
    resultDiv.innerHTML = `
      <strong>${carrerInp.value}, ${numInp.value.trim()}</strong>
      ${extra ? `<div class="geo-result-meta">${extra}</div>` : ""}
      <div class="geo-result-meta">
        ${selectedVia.tipusVia?.nom || ""} &nbsp;·&nbsp; Codi via: ${selectedVia.codi}
        &nbsp;·&nbsp; Barcelona
      </div>`;
  };

  [numInp, pisoInp, escaleraInp, puertaInp].forEach(el =>
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", updateResult)
  );

  display(root);
}
```
