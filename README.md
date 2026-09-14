# 🏎️ Paddock Scout

**Paddock Scout** is a real-time, machine-learning-powered Formula 1 race simulation and podium prediction dashboard. Using advanced predictive models and live web intelligence agents, it tracks team performance on the fly, scrapes top motorsport news outlets for aerodynamic upgrades, calculates qualifying and practice pace, and predicts win, top-2, and podium finish probabilities for any driver on the 2026 grid!


---

> [!NOTE]
> Before a race weekend begins, the model automatically relies on pre-race form weighting (rolling championship standings, team car rank, track suitability, and recent form) until live practice and qualifying sessions are ingested. Additionally, because the backend is hosted on Render's free tier, the web service spins down after 15 minutes of inactivity and may take ~30–50 seconds to wake up on the first request.

---

## What It Does (Features)

*   **Machine Learning Pipeline**: Trains a regularized `RandomForestClassifier` on historical F1 data from 2023–2026. The model uses "v6" features (like rolling championship standings, practice pace, and team car ranks) to avoid memorizing driver names, and applies a massive **×100 training weight** to the 2026 era so the model prioritizes current ground-effect aerodynamics and team hierarchies.
*   **Live Web Intelligence Agent**: Automatically searches top technical motorsport outlets (*The Race*, *F1Technical.net*, *Motorsport.com*) using a DuckDuckGo search agent to extract live updates about MGU-K power clipping, sidepod packages, and wing upgrades.
*   **Intelligent Upgrade Validation & Honest Tracking**: Cross-references reported news with real-time FP2 results. If a news outlet reports a "major upgrade" but the team is slower than P15 in practice, the upgrade is flagged as unvalidated and its performance boost is discounted. Confirmed, source-cited upgrades display with real pace deltas, while teams awaiting technical reports are shown with transparent `— PENDING` status (no fabricated components).
*   **Dynamic Session-Aware Feature Breakdown**: Automatically senses which live weekend sessions have concluded. The model cleanly adapts its weighting and status messaging through each phase of the weekend (pre-weekend form weighting $\rightarrow$ Friday practice pace active $\rightarrow$ Saturday fully ingested live grid & momentum), with tailored support for Sprint weekend schedules.
*   **Chronological Session Countdown**: A live header clock that tracks the upcoming weekend session in chronological order (`FP1` $\rightarrow$ `FP2` $\rightarrow$ `FP3` / `Sprint` $\rightarrow$ `Qualifying` $\rightarrow$ `Grand Prix`), stepping forward automatically as track action concludes.
*   **Overtake Index & Recovery Dynamics**: Evaluates midfield and front-runner recovery potential when fast cars start out of position due to penalties or qualifying mishaps by contrasting starting grid position with the car's rolling performance rank (`GridPosition - Car_Rank`).
*   📁 **Race Archive**: Dedicated historical archive covering every completed 2026 round, including Q1/Q2/Q3 qualifying session results, practice pace averages, and interactive podium classifications.

---

## 📊 Model Performance & 2026 Walk-Forward Benchmarks

Paddock Scout is evaluated using **walk-forward validation** across all 14 completed Grand Prix of the 2026 regulation season. At each round, the model strictly accesses data available prior to the race start (practice session telemetry, qualifying dominance gaps, and historical pace up to Round $R-1$), guaranteeing zero future data leakage.

### 2026 Season Evaluation (14 Grand Prix / 140 Driver Classifications)

| Metric | Paddock Scout | Starting Grid Baseline | Season Standings Baseline | Model Alpha ($\Delta$) |
| :--- | :---: | :---: | :---: | :---: |
| **Podium Hit Rate (Top-3)** | **66.7%** (28 / 42) | 61.9% (26 / 42) | 57.1% (24 / 42) | **+4.8%** 🏆 |
| **Points Finishers (Top-10)** | **72.1%** (101 / 140) | 76.4% (107 / 140) | 68.6% (96 / 140) | **-4.3%** |
| **Race Winner Accuracy (P1)** | **64.3%** (9 / 14) | 64.3% (9 / 14) | 50.0% (7 / 14) | **Tied (0.0%)** |
| **Brier Score (Podium)** *(lower = better)* | **0.0812** | 0.0829 | 0.0984 | **-0.0017** 🎯 |

### Key Analytical Takeaways
* **Generating Podium "Alpha" (+4.8%)**: In modern Formula 1, starting grid position is notoriously hard to beat due to aerodynamic wake ("dirty air"). By blending multi-session practice pace (`FP1`–`FP3`) with qualifying gap dominance and car ranking, Paddock Scout generated positive predictive alpha over the starting grid, correctly identifying **2 podium finishers** who started outside the top 3.
* **Points Finishers Trade-Off (-4.3%)**: The model slightly underperforms the raw grid on Top-10 retention (72.1% vs 76.4%). This reflects an architectural trade-off: the model actively rewards high race-pace recovery drives for front-running cars qualifying out of position rather than passively trusting a mid-pack starting slot—an area targeted for future feature regularization.
* **Championship Standings vs. Live Form (+9.6%)**: Simply picking the top drivers from the championship standings yielded a 57.1% podium rate. The model improved on this by +9.6%, accurately capturing shifting intra-season momentum and circuit suitability.
* **Probabilistic Calibration**: Achieved a Brier score of **0.0812** (outperforming the raw grid baseline of `0.0829`), confirming that the model's output probabilities reliably mirror true race frequencies rather than overconfident binary classifications.
* **Accounting for the 21.4% Attrition Ceiling**: In this 2026 dataset, **21.4% of race starts ended in retirement or mechanical failure (66 DNFs across 308 driver entries, averaging 4.7 per race)**. Uncontrollable stochastic events—such as Lewis Hamilton's Lap 6 terminal retirement in Spain after qualifying P4—create a natural variance ceiling for any pre-race model.

You can reproduce these benchmark numbers anytime by running:
```bash
python backend/benchmark.py --season 2026
```

---

## How to Set Up & Run Paddock Scout locally

### Prerequisites

*   Python 3.10 to 3.12+ installed on your computer.
*   Node.js (v18 or later) installed on your computer — this is required to run the React frontend.
*   An active internet connection (to fetch FastF1 schedule and run the live web search agent).
*   *Note: Zero API keys are needed! Both FastF1 and DuckDuckGo search operate entirely token-free.*

### 1. Clone this Repository

```bash
git clone https://github.com/mnarla/Paddock-Scout.git
cd Paddock-Scout
```

### 2. Set up a Virtual Environment

```bash
# Create the environment
python -m venv venv

# Activate it (Mac/Linux):
source venv/bin/activate

# Activate it (Windows):
venv\Scripts\activate
```

### 3. Install the Dependencies

```bash
pip install -r requirements.txt
```

### 4. Fetch the F1 Race Data

To download all historical seasons (2023–2026) to prepare for model training:

```bash
python backend/data_loader.py
```

Or, fetch just the current race weekend's data:

```bash
python backend/data_loader.py --current
```

You can also target specific weekend sessions using daily flags:

```bash
python backend/data_loader.py --current --friday    # Pulls Friday FP1 & FP2 (or FP1 & SQ)
python backend/data_loader.py --current --saturday  # Pulls Saturday FP3, Qualifying & Sprint
python backend/data_loader.py --current --sunday    # Pulls completed Grand Prix race results
```

*(Note: GitHub Actions also runs these daily ingestion steps automatically every Friday, Saturday, and Sunday evening via `.github/workflows/auto_ingest.yml`!)*

### 5. Train the Machine Learning Model

Run the training pipeline to fit the Random Forest model, serialize the persistent label encoders, and output classification reports and charts directly to the `models/` directory:

```bash
python backend/train_model.py
```

### 6. Start the Application

Paddock Scout uses a Flask backend and a React frontend. You will need two terminal windows open:

**Terminal 1: Start the API Backend**
```bash
# Make sure your virtual environment is active
source venv/bin/activate

# Start the server
python backend/api_server.py
```

**Terminal 2: Start the React Frontend**
```bash
# Navigate to the frontend directory
cd frontend

# Install frontend dependencies (if running for the first time)
npm install

# Start the Vite development server
npm run dev
```

Open your browser and navigate to the local address output by Vite (usually **http://localhost:5173**) to start predicting podium finishes!
