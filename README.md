<p align="center">
  <img src="public/icon.png" alt="Paddock Scout Icon" width="96" height="96" />
</p>

<h1 align="center">Paddock Scout</h1>

<p align="center">
  A real-time, machine-learning-powered Formula 1 race simulation and podium prediction dashboard. Tracks team performance, scrapes aerodynamic upgrades, calculates qualifying and practice pace, and predicts win, top-2, and podium finish probabilities for the 2026 grid.
</p>


> [!NOTE]
> Before a race weekend begins, the model automatically relies on pre-race form weighting (rolling championship standings, team car rank, track suitability, and recent form) until live practice and qualifying sessions are ingested. Additionally, because the backend is hosted on Render's free tier, the web service spins down after 15 minutes of inactivity and may take ~30–50 seconds to wake up on the first request.

---

## What It Does (Features)

*   **Machine Learning Pipeline**: Trains a regularized `RandomForestClassifier` on historical F1 data from 2023–2026. The model uses "v6" features (like rolling championship standings, practice pace, and team car ranks) to avoid memorizing driver names, and applies a massive **×100 training weight** to the 2026 era so the model prioritizes current ground-effect aerodynamics and team hierarchies.
*   **Live Technical Upgrade Intelligence Agent**: Automatically monitors motorsport feeds (*The Race*, *Autosport*, *Motorsport.com*, *Formula 1*) with a strict **3-week rolling window** to capture current race packages and recently introduced active specs. Powered by Google News RSS discovery and batched Gemini extraction, eliminating stale multi-month or obsolete historical articles.
*   **Dynamic Pace Evaluation & Failure Awareness**: Unlike static lookup tables, lap time deltas are evaluated dynamically from engineer/team quotes and reported aerodynamic scope. The agent detects **bouncing, porpoising, or balance rupture** (`DEFECTIVE` with lap time penalties) and tracks Friday-night wing removals (`REVERTED`). Upgrades display clean 3-tier statuses:
    *   🟢 **NEW THIS WEEKEND**: Fresh package introduced for the active Grand Prix.
    *   🔵 **ACTIVE SPEC**: Verified package running from the past 1–2 races.
    *   ⚪ **STANDARD BASELINE**: Teams without upgrades in the last 3 weeks cleanly reflect standard baseline car spec (`±0.00s`), with zero ancient links.
*   **Dynamic Session-Aware Feature Breakdown**: Automatically senses which live weekend sessions have concluded. The model cleanly adapts its weighting and status messaging through each phase of the weekend (pre-weekend form weighting $\rightarrow$ Friday practice pace active $\rightarrow$ Saturday fully ingested live grid & momentum), with tailored support for Sprint weekend schedules.
*   **Chronological Session Countdown**: A live header clock that tracks the upcoming weekend session in chronological order (`FP1` $\rightarrow$ `FP2` $\rightarrow$ `FP3` / `Sprint` $\rightarrow$ `Qualifying` $\rightarrow$ `Grand Prix`), stepping forward automatically as track action concludes.
*   **Overtake Index & Recovery Dynamics**: Evaluates midfield and front-runner recovery potential when fast cars start out of position due to penalties or qualifying mishaps by contrasting starting grid position with the car's rolling performance rank (`GridPosition - Car_Rank`).
*   📁 **Race Archive**: Dedicated historical archive covering every completed 2026 round, including Q1/Q2/Q3 qualifying session results, practice pace averages, and interactive podium classifications.

---

<!-- START_BENCHMARKS -->
## 📊 Model Performance & 2026 Walk-Forward Benchmarks

Paddock Scout is evaluated using **walk-forward validation** across all 15 completed Grand Prix of the 2026 regulation season. At each round, the model strictly accesses data available prior to the race start (practice session telemetry, qualifying dominance gaps, and historical pace up to Round $R-1$), guaranteeing zero future data leakage.

### 2026 Season Evaluation (15 Grand Prix / 150 Driver Classifications)

| Metric | Paddock Scout | Starting Grid Baseline | Season Standings Baseline | Model Alpha ($\\Delta$) |
| :--- | :---: | :---: | :---: | :---: |
| **Podium Hit Rate (Top-3)** | **64.4%** (29 / 45) | 60.0% (27 / 45) | 53.3% (24 / 45) | **+4.4%** 🏆 |
| **Points Finishers (Top-10)** | **72.0%** (108 / 150) | 75.3% (113 / 150) | 70.7% (106 / 150) | **-3.3%** |
| **Race Winner Accuracy (P1)** | **66.7%** (10 / 15) | 66.7% (10 / 15) | 53.3% (8 / 15) | **Tied (0.0%)** |
| **Brier Score (Podium)** *(lower = better)* | **0.0833** | 0.0862 | 0.0988 | **-0.0028** 🎯 |

### Key Analytical Takeaways
* **Generating Podium "Alpha" (+4.4%)**: In modern Formula 1, starting grid position is notoriously hard to beat due to aerodynamic wake ("dirty air"). By blending multi-session practice pace (`FP1`–`FP3`) with qualifying gap dominance and car ranking, Paddock Scout generated positive predictive alpha over the starting grid, correctly identifying **2 podium finishers** who started outside the top 3.
* **Points Finishers Trade-Off (-3.3%)**: The model slightly underperforms the raw grid on Top-10 retention (72.0% vs 75.3%). This reflects an architectural trade-off: the model actively rewards high race-pace recovery drives for front-running cars qualifying out of position rather than passively trusting a mid-pack starting slot—an area targeted for future feature regularization.
* **Championship Standings vs. Live Form (+11.1%)**: Simply picking the top drivers from the championship standings yielded a 53.3% podium rate. The model improved on this by +11.1%, accurately capturing shifting intra-season momentum and circuit suitability.
* **Probabilistic Calibration**: Achieved a Brier score of **0.0833** (outperforming the raw grid baseline of `0.0862`), confirming that the model's output probabilities reliably mirror true race frequencies rather than overconfident binary classifications.
* **Accounting for the 22.1% Attrition Ceiling**: In this 2026 dataset, **22.1% of race starts ended in retirement or mechanical failure (73 DNFs across 330 driver entries, averaging 4.9 per race)**. Uncontrollable stochastic events—such as Lewis Hamilton's Lap 6 terminal retirement in Spain after qualifying P4—create a natural variance ceiling for any pre-race model.

You can reproduce these benchmark numbers anytime by running:
```bash
python backend/benchmark.py --season 2026
```
<!-- END_BENCHMARKS -->

---

## How to Set Up & Run Paddock Scout locally

### Prerequisites

*   Python 3.10 to 3.12+ installed on your computer.
*   Node.js (v18 or later) installed on your computer — this is required to run the React frontend.
*   An active internet connection (to fetch FastF1 schedule and run the live web search agent).
*   A `GEMINI_API_KEY` (in `.env`) for the automated technical upgrade intelligence pipeline. FastF1 telemetry ingestion remains completely token-free.

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

### 5b. Run the Live Technical News Agent (Optional / On-Demand)

To manually scrape the latest technical upgrades across the grid within the last 3 weeks:

```bash
python backend/news_agent.py
```
*(Note: When the API server is running, it automatically checks freshness every 6 hours on race weeks and exposes `POST /api/refresh-upgrades` for automated cron triggers).*

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
