# Reconstructing a life and social relationships from Epistolary Network Analysis: Luis Mitrovic Balbontín Archive

**Felipe Bengoa Trucco**  
MA Digital Humanities — University of Groningen, 2026  
Supervisor: Franziska Pannach

---

## Abstract

This thesis investigates how Named Entity Recognition (NER) and social network analysis can reconstruct the social world of an individual from a fragmentary, uncatalogued personal archive. The case study is the correspondence of Luis Mitrovic Balbontín (1911–2008), a Chilean architect and photographer whose archive, held by Fundación Enterreno, comprises more than 17,000 photographic items and approximately 3,500 letters, but had received no prior systematic study. A working corpus of 141 multilingual documents (Spanish, English, German) was assembled, processed through a Stanza-based NER pipeline, and used to construct an ego-centred correspondence network in Gephi. The pipeline extracted 1,149 unique entities across 2,633 mentions, producing a network of 147 nodes and 662 edges. Analysis of this network identifies central mediators, geographic clusters, and temporal patterns consistent with Mitrovic's documented biographical periods. The thesis argues that epistolary network analysis can function as an exploratory methodology for unknown personal archives, cultivating serendipitous discovery while producing replicable, citable results, and that the structured knowledge it generates can anchor future work on the associated photographic collection.

---

## Interactive visualizations

- **Correspondence network viewer** — [Open](https://felipebengoat.github.io/DH-thesis-mitrovic-archive/network/network_viewer.html)  
  Explore 147 nodes and 662 edges. Switch between four color modes: node type, biographical period, correspondence language, and Louvain community. Click any node to see its attributes and top connections. Optimized for desktop browsers.

- **Geographic correspondence map** — [Open](https://felipebengoat.github.io/DH-thesis-mitrovic-archive/map/mitrovic_map.html)  
  Arc layer mapping correspondence flows between origin and destination. Point layer locating Mitrovic at the time of each letter. Built with Kepler.gl. (Wait a minute for the map to load)

---

## Repository structure

```
mitrovic-archive/
│
├── data/
│   ├── raw/                    # Original corpus CSVs and NER source files
│   ├── processed/              # Normalized NER outputs and Kepler datasets
│   └── network/                # nodes.csv and edges.csv for Gephi import
│
├── notebooks/                  # Jupyter notebooks (10 total, numbered sequentially)
│   ├── 1_BaselineNetwork.ipynb
│   ├── 2_Visual_Standards.ipynb
│   ├── 3_PilotSample_NER_Distribution.ipynb
│   ├── 4_Evaluation_NER_Models.ipynb
│   ├── 5_Phase2_NER_PreNorm.ipynb
│   ├── 6_Phase2_NER_PostNorm.ipynb
│   ├── 7_Phase3_NER_FullCorpus.ipynb
│   ├── 8_Phase3_FIGS_PostNorm.ipynb
│   ├── 9_Phase4_CSV_Creation_Network.ipynb
│   └── 10_Map_Data_Creation.ipynb
│
├── figures/                    # All thesis figures (PNG)
├── gephi/                      # Gephi project files (.gephi)
├── docs/
│   ├── network/                # Sigma.js interactive network viewer
│   └── map/                    # Kepler.gl correspondence map
│
└── README.md
```

---

## Pipeline summary

The analysis follows an iterative three-phase pipeline:

**Phase 1 — Baseline network** (Notebook 1)  
A correspondence network constructed from letter metadata alone (sender, recipient, date, origin, destination), establishing what the archive reveals through structure before any content analysis.

**Phase 2 — Intermediate NER cycle** (Notebooks 3–6)  
A pilot sample of 19 documents established the corpus typology and identified non-epistolary materials. A formal evaluation of four NER models (spaCy, Stanza, BERT-NER, XLM-RoBERTa) selected Stanza as the primary tool (F1=0.77). An intermediate cycle applied Stanza to 50 documents, with manual annotation for 15 German-language letters and two-layer normalization.

**Phase 3 — Full corpus NER** (Notebooks 7–8)  
The complete pipeline was applied to 141 documents. A gazetteer-based propagation mechanism carried normalized entities from Phase 2 into the full corpus. Post-normalization: 949 PER mentions (422 unique), 1,329 LOC mentions (471 unique), 355 ORG mentions (256 unique).

**Phase 4 — Network construction** (Notebook 9)  
Nodes and edges CSV files were constructed from the normalized NER output and letter metadata. The canonical network (V3) contains 147 nodes and 662 edges, with a density of 0.06, diameter of 4, and modularity of 0.33 across 11 Louvain communities.

**Geographic data** (Notebook 10)  
Two datasets were constructed for Kepler.gl: an arc layer mapping correspondence flows and a point layer locating Mitrovic at the time of each letter based on sender and recipient roles.

---

## Requirements

```
Python 3.11+
stanza==1.11.1
pandas
matplotlib
networkx
pathlib
adjustText
```

Install dependencies:

```bash
pip install stanza pandas matplotlib networkx adjustText
```

Each notebook includes a reproducibility cell that prints package versions. Notebooks 5 and 7 run Stanza on the full corpus and may take several minutes. All other notebooks load pre-computed results from `data/processed/`.

---

## Data

The Luis Mitrovic Balbontín archive is held and being digitized by Fundación Enterreno (Santiago, Chile). The epistolary corpus was transcribed and conserved by Marcela Roubillard.

The CSV files in `data/raw/` contain transcribed letter metadata and normalized NER outputs. Original letter scans (JPG, low resolution) and plain-text transcriptions are included in `data/raw/letters/`, organized by envelope identifier (S3–S202). Digitization by Marcela Roubillard, Fundación Enterreno, 2023–2026.

---

## Visual design standards

All figures follow a consistent color system documented in Notebook 2 and `figures/fig_color_reference_v3.png`:

| Palette | Keys | Colors |
|---|---|---|
| NER entities | PER / LOC / ORG | `#2E8B57` / `#E07B39` / `#4A6FA5` |
| Node type | Ego / Direct / Mentioned | `#1A1A1A` / `#C0392B` / `#5DADE2` |
| Biographical period | European / Chilean / US / 2+ | `#9B59B6` / `#16A085` / `#D4AC0D` / `#9F9F9F` |
| Correspondence language | German / Spanish / English | `#9B59B6` / `#16A085` / `#D4AC0D` |

---

## Network methodology note

All edge weights in the Gephi export are exactly double the true co-mention counts due to a duplicate CSV import during network construction. This does not affect topological metrics (degree, betweenness, modularity, diameter) but invalidates direct citation of edge weight values. 

The canonical Louvain partition (11 communities, Q=0.33) is stored in `gephi/LuisMitrovicV4.gephi` and must not be re-executed, as the algorithm is non-deterministic and results would not be reproducible.

---

## License

MIT License. See `LICENSE` for details.

---

## Citation

Bengoa Trucco, F. (2026). *Reconstructing a life and social relationships from Epistolary Network Analysis: Luis Mitrovic Balbontín Archive*. MA thesis, University of Groningen. Available at: https://github.com/felipebengoat/DH-thesis-mitrovic-archive
