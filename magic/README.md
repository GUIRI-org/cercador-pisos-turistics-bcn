# Data pipelines and coding guidelines

This document describes the data pipelines included in this project and a guide that provides instructions for collaboration, code development, and programming style when building data pipelines.

**Table of contents**

- [Data pipelines](#data-pipelines)
- [Topic modeling pipelines](#topic-modeling-pipelines)
- [Development guidelines for Mage pipelines](#development-guidelines-for-mage-pipelines)

## Data pipelines

The project includes nine data integration, enrichment, validation, and maintenance pipelines that process projects from the `ris3mcat` database. Each pipeline is designed for a specific integration or enrichment task:

### Data Integration Pipelines

| Pipeline Name                          | Machine name                                 | Purpose                                                                                                      | Data Source                                                | README                                                                                  |
| -------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **SIFECAT integration (main)**         | `ris3mcat_integration_sifecat_all`           | Import SIFECAT FEDER 2021-2027 projects and beneficiaries (excluding CPI operation `EC10-000023`).         | Google Sheets                                              | [Open](./mage-ris3mcat25/markdowns/ris3mcat_integration_sifecat_all_readme.md)         |
| **SIFECAT CPI integration**            | `ris3mcat_integration_sifecat_cpi`           | Import 18 Public Innovation Procurement contracts from operation `EC10-000023` with role-based attribution. | Google Sheets (2 sources)                                  | [Open](./mage-ris3mcat25/markdowns/ris3mcat_integration_sifecat_cpi_readme.md)         |

**Note**: Both SIFECAT pipelines import FEDER 2021-2027 program data (approved from 2024 onwards) and require **manual institution disambiguation** after execution. See individual pipeline documentation for post-execution workflow details.

### Data Enrichment & Maintenance Pipelines

| Pipeline Name                          | Machine name                                 | Purpose                                                                                                      | Tool/Library                                                | README                                                                                  |
| -------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Test database connection**           | `common_test_database`                       | Validate read/write access to the PostgreSQL database and confirm connectivity.                              | Native PostgreSQL                                           | [Open](./mage-ris3mcat25/markdowns/common_test_database_readme.md)                      |
| **Keyword extraction enrichment**      | `ris3mcat_projects_enrichment_keywords`      | Extract and assign keywords to projects using a custom controlled vocabulary.                                | [Exkeyliword](https://github.com/sirisacademic/exkeyliword) | [Open](./mage-ris3mcat25/markdowns/ris3mcat_projects_enrichment_keywords_doc.md)        |
| **SDGs classification enrichment**     | `ris3mcat_projects_enrichment_sdgs`          | Classify projects against the United Nations Sustainable Development Goals framework.                        | [Voctagger](https://github.com/sirisacademic/voctagger)     | [Open](./mage-ris3mcat25/markdowns/ris3mcat_projects_enrichment_sdgs_doc.md)            |
| **RIS3CAT classification enrichment*** | `ris3mcat_projects_enrichment_systems`       | Assign RIS3CAT system classification to projects using a pre-trained neural network model (~3.2GB).          | Custom fine-tuned model                                     | [Open](./mage-ris3mcat25/markdowns/ris3mcat_projects_enrichment_systems_ris3cat_doc.md) |
| **Topic modeling inference**           | `ris3mcat_projects_enrichment_tm_inference`  | Infer topics and compute 2D visualization positions for projects using a pre-trained BERTopic model.         | [BERTopic](https://maartengr.github.io/BERTopic/), t-SNE    | [Open](./mage-ris3mcat25/markdowns/ris3mcat_projects_enrichment_tm_inference_doc.md)    |
| **Topic modeling generation**          | `ris3mcat_projects_enrichment_tm_generation` | Train a new BERTopic model on project texts and update cluster definitions and keywords in the database.     | [BERTopic](https://maartengr.github.io/BERTopic/), SBERT    | [Open](./mage-ris3mcat25/markdowns/ris3mcat_projects_enrichment_tm_generation_doc.md)   |
| **Materialized views refresh**         | `ris3mcat_sql_views_refresh`                 | Refresh all materialized views in ontop and dbcache schemas to make enrichment data visible to the frontend. | Native PostgreSQL                                           | —                                                                                       |

***: The RIS3CAT classification enrichment pipeline requires downloading pre-trained model files (~3.2GB) from [Google Drive](https://drive.google.com/drive/u/0/folders/1F_iSglIWDhlVSvBBl7mMtXcCpCO8m-mC). See [infrastructure setup guide](../infra/README.md#downloading-model-data-for-ris3cat-systems-enrichment-pipelines) for download instructions.

### Orchestration Pipelines

| Pipeline Name                          | Machine name                                      | Purpose                                                                                                                                                       | README                                                                                        |
| -------------------------------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **TM and enrichments orchestration**   | `ris3mcat_orchestration_enrichments`              | Orchestrate the complete Topic Modeling and enrichment workflow: generation → inference → keywords → SDGs → RIS3CAT systems → views refresh (all parallel). | [Open](./mage-ris3mcat25/markdowns/ris3mcat_orchestration_enrichments_readme.md)             |

## Topic modeling pipelines

Topic modeling automatically discovers thematic clusters within large collections of research projects by analyzing their titles and abstracts. For RIS3-MCAT, this creates an interactive map where projects with similar research themes are grouped together, making it easier to explore Catalunya's R&D landscape and identify research trends across thousands of projects.

The system uses a two-phase approach: first, a **generation pipeline** trains a model to learn research themes from all existing projects and defines cluster boundaries. Then, an **inference pipeline** automatically assigns any new projects to the appropriate clusters as they enter the database. This keeps the visualization current without needing to retrain the entire model.

The platform uses two complementary pipelines for topic modeling based on [BERTopic](https://maartengr.github.io/BERTopic/):

**Generation pipeline** (`ris3mcat_projects_enrichment_tm_generation`):
- Trains a new BERTopic model on all projects from both CORDIS and SIFECAT schemas
- Uses keyword-guided clustering (via Google Sheets) to initialize topic groups with KMeans
- Generates embeddings using [SentenceTransformer (allenai-specter)](https://huggingface.co/sentence-transformers/allenai-specter) and stores them in `project_embedding` tables
- Computes 2D t-SNE projections for both project positions and cluster centers
- Updates `common.bert_clusters` and `common.bert_cluster_keywords` tables with cluster metadata
- Saves trained model to `data/topic_modeling/models/` for reuse
- Runs on-demand via manual trigger

**Inference pipeline** (`ris3mcat_projects_enrichment_tm_inference`):
- Loads the pre-trained BERTopic model and infers topics for new/unclustered projects
- Computes 2D t-SNE coordinates for visualization
- Updates schema-specific `project_bert` tables with cluster assignments and positions
- Runs automatically via schema-specific triggers (`cordis_schedule`, `sifecat_schedule`)
- Processes only projects not yet present in `project_bert` tables

Both pipelines rely on existing embeddings stored in the database to avoid recomputation, generating new embeddings only for projects that lack them. The generation pipeline uses dynamic blocks to automatically handle multiple schemas without code duplication.

**Orchestration pipeline** (`ris3mcat_orchestration_enrichments`):
- Automates the complete TM and enrichment workflow in sequence:
  1. Generation → 2. Inference (parallel) → 3. Keywords (parallel) → 4. SDGs (parallel) → 5. RIS3CAT systems (parallel) → 6. Views refresh
- Eliminates manual intervention between pipeline stages
- Ensures all dependent pipelines complete successfully before proceeding
- All enrichment stages execute CORDIS and SIFECAT schemas in parallel for efficiency
- Expected runtime: ~3-5 hours for the complete workflow
- See [orchestration pipeline documentation](./mage-ris3mcat25/markdowns/ris3mcat_orchestration_enrichments_readme.md) for details

## Development guidelines for Mage pipelines

[Follow these next guidelines](./mage_guidelines.md) if you are planning to contribute to this project by maintaining or developing data pipelines with Mage.ai.
