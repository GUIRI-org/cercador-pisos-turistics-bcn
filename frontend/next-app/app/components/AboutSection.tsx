export function AboutSection() {
  return (
    <section id="seccio-about">
      <div className="container">
        <h1>Una eina ciutadana, amb context</h1>
        <p className="fs-5 text-gray-600 lh-base">
          El projecte acosta la informació pública sobre habitatges d&apos;ús turístic a una consulta quotidiana: què hi ha registrat a la meva finca i al meu entorn?
        </p>
        <div className="row gy-4 mt-2">
          <div className="col-12 col-md-4">
            <h2>Consulta local</h2>
            <p className="text-gray-600">Busca per carrer i número per revisar els registres associats a una adreça de Barcelona.</p>
          </div>
          <div className="col-12 col-md-4">
            <h2>Dades obertes</h2>
            <p className="text-gray-600">La informació es presenta a partir de registres públics i es relaciona amb el mapa dels barris.</p>
          </div>
          <div className="col-12 col-md-4">
            <h2>Lectura responsable</h2>
            <p className="text-gray-600">Les dades poden tenir mancances o desfasaments. No trobar un registre no és, per si sol, una determinació sobre la legalitat d&apos;un habitatge.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
