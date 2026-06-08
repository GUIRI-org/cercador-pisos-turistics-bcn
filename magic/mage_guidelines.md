# Development guidelines for Mage pipelines

Follow these next guidelines if you are planning to contribute to this project by maintaining or developing data pipelines with Mage.ai.

- [High-Level guidelines](#high-level-guidelines)
- [General guidelines](#general-guidelines)
- [Python development guidelines](#python-development-guidelines)
- [Configuration Settings and Credentials](#configuration-settings-and-credentials)
- [Databases](#databases)
- [Naming conventions](#naming-conventions)
- [Workflow Implementation](#workflow-implementation)
- [Triggers and events](#triggers-and-events)

## High-Level guidelines

- Ensure coherence.
- Avoid rewriting existing code to follow this guide.
- Don't break a guideline without a valid reason.
- A reason is valid when you can convince a teammate.

## General guidelines

- [CHANGELOG Management](../CHANGELOG.md)
- [Semantic Versioning](https://semver.org/spec/v2.0.0.html)

## Python development guidelines

- Follow [PEP 8](https://peps.python.org/pep-0008/).
- Use `docstring` in all functions; see [PEP 257](https://peps.python.org/pep-0257/).
- Use `requirements.txt` to add Python packages and pin every dependency carefully.

## Configuration Settings and Credentials

- Don't include credential values in the source code.
- Use [environment variables](https://docs.mage.ai/development/variables/environment-variables#environment-variables-in-mage) to store configuration settings and credentials.
- Document new environment variables added to the project as a new entry/ies in the [env.sample](../infra/.env.sample) file.
- Use the default profile in [Mage's IO Config](https://docs.mage.ai/development/io_config) to set up information and credentials that are common to all pipelines.
- Prefer environment variables over [secrets](https://docs.mage.ai/development/variables/secrets) for storing passwords and credentials.
- Don't activate the option `triggers.save_in_code_automatically` by default. 
  Its prefered to enable this feature on a pipeline basis rather than for all by default. It can be inconvenient when trying to implement git-based deployments on the production server.


## Databases

- Use a new set of environment variables for every PostgreSQL database connection added to the project. For example:
    - `POSTGRES_HOST_{your-new-source}`
    - `POSTGRES_USER_{your-new-source}`
    - `POSTGRES_DB_{your-new-source}`
    - `POSTGRES_PASSWORD_{your-new-source}`
    - `PG_HOST_PORT_{your-new-source}`
- Add a new profile in [Mage's IO Config](https://docs.mage.ai/development/io_config) for every new PostgreSQL database connection added to the project.
    - Use the same [database schema name](https://www.postgresql.org/docs/current/ddl-schemas.html) as in the production database. For example, `arterdb`, `venetodb`.
- Follow the [Database Management](../database/README.md) guidelines.
- Keep the database dump updated.

## Naming conventions

Use the following naming convention for all pipelines and blocks in this project. This will facilitate code maintenance and ensure consistency and clarity across the codebase.

**Pipelines** names are composed of `{project}_{entity}_{type}_{name}`

- `{project}`: Represents the name of the project. Examples: `ris3mcat25`, `arter`, etc.
- `{entity}`: Represents the name of the affected entity. Examples: `projects`, `publications`, `works`, etc.
- `{type}`: Represents the type of pipeline. Types: `enrichment`, `integration`.
- `{name}`: Represents the name of the enrichment performed or the data source integrated. Examples: `keywords`, `sdgs` for enrichments or `keep`, `openalex` for integrations. Examples: 
    - `ris3mcat25_projects_integration_keep`
    - `ris3mcat25_projects_enrichment_keywords`
    - `ris3mcat25_projects_integration_cordis`
    - `ris3mcat25_projects_enrichment_keywords`
    - `ris3mcat25_projects_enrichment_sdgs`, ...

**Blocks** names are composed of `{pipeline_name}_{operation}`.

- For [Data Loader Blocks](https://docs.mage.ai/design/blocks/data-loader), `{operation}` takes the value `get_{entity}`.
- For [Data Exporter Blocks](https://docs.mage.ai/design/blocks/data-exporter), `{operation}` takes the value `store_{destination}` and `log_{destination}`, where `{destination}` can be: 
    - `db`: for PostgreSQL databases 
    - `bq`: for BigQuery 
    - `csv`: for CSV files 
    - `gsheet`: for Google Sheet files 
    - XLS, DuckDB, Kafka, Opensearch, ...
- For [Transformer Blocks](https://docs.mage.ai/guides/blocks/transformer-blocks#transformer-blocks), and other types of blocks, `{operation}` takes the value `transform` and/or whatever you find appropriate.
- Prefer previously used `{operation}` block names from existing pipelines over new ones.

**Triggers** names are composed of `{pipeline-name}_{schema}_schedule`.
  - `{schema}`: Represents the name of the affected schema.

**Keep this page updated** with the naming convention policy.

## Workflow Implementation

- Aim for the lowest number of blocks in each pipeline.
- Despite previous comment, balance modularity and block complexity, especially for transformation blocks.
    - "Each block of code has a single responsibility: load data from a source, transform data, or export data anywhere." -- [Mage design principles](https://docs.mage.ai/design/core-design-principles)
- Add a description to all pipelines as it appears in the UI Administration.
- Use [pipeline variables and keyword arguments](https://docs.mage.ai/getting-started/runtime-variable) to execute the same pipeline on different schemas of the same database.
    - Adding a json file to the `data` folder with all the possible values from the sample database dump is required.
- [Use tags](https://docs.mage.ai/pipelines/pipeline-tagging) to classify pipelines based on the convention name values used for `{project}` and `{type}`.
- Add [data validation tests](https://docs.mage.ai/development/data-validation) to loader and transformer blocks.
- All blocks of the pipeline must have `status` set to `executed` before merging them to the main branch.
- Use [basic logging](https://docs.mage.ai/development/observability/logging#edit-pipeline-logging) with the `print` statement to log events from block executions.
    - Add a `➡ ` at the beginning of all messages.

**Enrichment workflows**

- All enrichment pipelines must use a database table ("Control table") to keep a log of all unique entities that have been processed.
- Enrichment pipelines must load only those projects that meet all of the required data conditions. Therefore, excluding items that don't have the necessary data for the enrichment algorithm must be done in loader blocks of the pipeline, not in the transformer block.
    - Example: when extracting keywords from projects, don't load those with an empty abstract field.
- Use control tables in [Data Loader Blocks](https://docs.mage.ai/design/blocks/data-loader) to avoid processing the same row twice.
    - Control tables must include a timestamp column.
    - Prefer previously control table names from existing pipelines over new ones with a different convention.
- Update control tables only if target tables have been successfully updated.
- Keep the database dump updated:
    - Add to the local sample database only the tables that are necessary for the enrichment workflow.
        - Add the primary key constraints from the original data set.
        - Add the necessary foreign key constraints from the original data set.
    - Add a sample of ~100 rows of the main entity source table: projects, publications, ...
    - Leave target and control tables empty before merging the database dump to the main branch.
- When execution of the same enrichment pipeline on all schemas of the same database is required, prefer an additional pipeline that consumes an input JSON file to invoke the workflow on each schema, rather than multiple triggers with hard-coded argument values.

## Triggers and events

- Use triggers to execute pipelines with [variables and keyword arguments](https://docs.mage.ai/getting-started/runtime-variable) for all schemas in a `{project}` database.
- Always add triggers to the source code:
    - Use the same name as the pipeline, and add the trigger's type at the end: `{pipeline_name}_schedule`, `{pipeline_name}_event` or `{pipeline_name}_api`.
