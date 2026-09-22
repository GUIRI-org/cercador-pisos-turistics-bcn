# Como vamos a consumir la API en el buscador.

**Paso 1, busqueda por via en GeoBCN para obtener nomComplet**

El usuario introduce nombre de via, ex. "sants"
    - input: "sants" 
    - output:
      - Nombre completo: "Carrer de Sants"
      - Lista posible de números 
    - Llamada: `/geoBCN/serveis/territori?q=sants`

Recogemos del objeto 'vies':
    - codi: 312400
    - nomComplet: "Carrer de Sants"
    - nom: "SANTS"
    - tipusViaAbr: "C",

**Paso 2, busqueda por nombre via completo en GeoBCN para obtener numeracion**

El usuario introduce nombre de via, ex. "sants"
    - input: "Carrer de Sants" 
    - output:
      - Lista posible de números 
    - Llamada: `/geoBCN/serveis/territori?q=Carrer de Sants`

Recogemos del objeto 'adreces', filtrado por "nomComplet LIKE 'Carrer de Sants%'":    
    - Lista de valores posibles de "numeracioPostal"

Ojo que la API puede devolver más de una "via" a partir de la busqueda por nombre completo "Carrer de Sants"; mirar ejemplo de la API collection.

**Paso 3, búsqueda per adreça completa en GeoBCN para obtener atributos relacionados**

El usuario ha introducido ya la numeración ex. "21", y ya tenemos el detalle de la via completo, (id, nombreCompleto, ...)
    - input: "Carrer de Sants, 21"
    - output:
      - Adreça completa: 'Carrer de Sants, 21'
      - Atributs d'entitats GeoBCN: illa, districte, ...
    - Llamada: `/geoBCN/serveis/territori?q=Carrer de Sants, 21`

Recogemos del objeto 'adreces', filtrado por "numeracioPostal = '21'":    
    - id: 31240000212002120
    - ....
    - carrer (objeto)
    - illa (objeto)
    - districte (objeto)
    - barri (objeto)

   - input "Carrer de Sants, 22"


**Paso 4, búsqueda per adreça completa en Apartamento para obtener objeto licencia y objeto airbnb**

> Version actual con fuzzy search, require logica de frontend.

Hacemos llamada al endpoint fuzzy search de la api:
    - input: sants, 21
    - output: 
      - apartments (objeto)
        - licencia (objeto)

            ````json
            {
                "expedient": "03-2013-0773",
                "registre_generalitat": "HUTB-008163",
                "num_places": 8,
                "year": null,
                "bloc": null,
                "portal": null,
                "escala": null,
                "pis": "05",
                "porta": "3"
            }
            ````


- Llamada: {{baseURL}}/api/v1/apartments/search?carrer=sants&num1=215